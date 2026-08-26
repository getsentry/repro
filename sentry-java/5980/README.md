# Reproduction for sentry-java#5980

**Issue:** https://github.com/getsentry/sentry-java/issues/5980

## Description

The reporter sees this during the first app start on Xiaomi devices with Android 12:

```
android.database.SQLException: Error code: 5,
message: Timed out attempting to acquire a writer connection.

Writer pool: capacity=1, permits=0
Status: Free connection
```

The setup is Room 3 with `BundledSQLiteDriver`, wrapped in a user-supplied `SQLiteDriver` that
applies PRAGMAs, and the Sentry Android Gradle Plugin (SAGP), which rewrites
`RoomDatabase.Builder.setDriver(driver)` into `setDriver(SentrySQLiteDriver.create(driver))`.

This project rebuilds that setup exactly and puts a configurable burst of concurrent Room 3
database work on top of it, so that the writer pool can be put under pressure.

The driver chain at runtime is:

```
SentrySQLiteDriver -> PragmaConfiguringDriver -> BundledSQLiteDriver
```

## Steps to Reproduce

1. Start an emulator or attach a device, then install and run with the SAGP instrumentation
   enabled (this is the default):

   ```bash
   ./gradlew :app:installDebug
   adb shell pm clear io.repro.issue5980
   adb logcat -c
   adb shell am start -n io.repro.issue5980/.MainActivity \
     --ei writers 16 --ei readers 16 --ei ops 200
   adb logcat -d | grep -E "Repro5980"
   # Room logs the pool timeout via printStackTrace, under the System.err tag:
   adb logcat -d | grep "Timed out attempting to acquire a writer connection"
   ```

2. Install and run the baseline, with the instrumentation disabled:

   ```bash
   ./gradlew :app:installDebug -PsentryInstrumentation=false
   ```

   Then repeat the `am start` above and compare.

### Knobs

| Knob | Where | Default | Meaning |
| --- | --- | --- | --- |
| `-PsentryInstrumentation` | Gradle | `true` | SAGP bytecode instrumentation on/off |
| `-PsentryFeatures` | Gradle | all four | comma-separated `InstrumentationFeature` names, e.g. `DATABASE` |
| `--ei writers` | intent extra | `8` | concurrent coroutines that insert |
| `--ei readers` | intent extra | `8` | concurrent coroutines that query |
| `--ei ops` | intent extra | `60` | operations per worker |
| `--ez warmup` | intent extra | `false` | when `false`, the burst races Room's first open |
| `--ei lockCycles` | intent extra | `200` | lock/unlock cycles for the `FileLockProbe` |
| `--ei raceRounds` | intent extra | `20` | rounds of Room's contended first open |
| `--ei raceConcurrency` | intent extra | `8` | concurrent openers per round |

The DSN is empty by default. `export SENTRY_DSN=...` before building to send the data to a real
project. Without it the app falls back to `https://key@127.0.0.1/1`: the DSN must stay
syntactically valid, because an empty DSN disables the SDK and then
`SentrySQLiteStatement` records no span at all and the instrumentation becomes a no-op.
The envelopes simply fail to be delivered.

## Expected Behavior

Room's writer connection is acquired and released normally. No pool timeout.

## Actual Behavior

**The writer timeout did NOT reproduce**, on either of two emulators — including an Android 12 /
API 32 image chosen to match the report. The harness runs, the instrumentation is confirmed
active, and the writer pool never times out. Roughly 40 runs on Android 12 produced zero
occurrences of `Timed out attempting to acquire a writer connection`.

Write burst, 16 writers x 200 inserts + 16 readers x 200 queries against two Room 3 databases,
cold database on every run:

| Emulator | SAGP instrumentation | run 1 | run 2 | run 3 | pool timeouts |
| --- | --- | --- | --- | --- | --- |
| Android 12, API 32, arm64 | on (all features) | 2132 ms | 1808 ms | 1874 ms | 0 |
| Android 12, API 32, arm64 | off | 1591 ms | 1328 ms | 1245 ms | 0 |
| API 36, arm64 | on (all features) | 4461 ms | 5095 ms | 5062 ms | 0 |
| API 36, arm64 | off | 5041 ms | 4534 ms | 4114 ms | 0 |

On Android 12 the instrumentation costs a consistent ~40% on the burst; on API 36 the difference
was inside the noise. Neither is anywhere near the factor needed to exhaust Room's 30 second pool
timeout. Read the notes below before treating this reproduction as a negative result for the SDK.

### SAGP configuration

`app/build.gradle.kts` only sets `tracingInstrumentation.enabled`. That is enough for the
`DATABASE` feature, because SAGP's defaults are `enabled = true` and
`features = [DATABASE, FILE_IO, OKHTTP, COMPOSE]`
([docs](https://docs.sentry.io/platforms/android/configuration/gradle/#tracing-instrumentation)),
so nothing else has to be opted into. `-PsentryInstrumentation=false` flips `enabled` for the
baseline build.

### What was verified

Both claims below were checked on the built APK, not inferred from the Gradle config:

| Check | instrumentation on | instrumentation off |
| --- | --- | --- |
| `SentrySQLiteDriver.create` call sites in the dex | 1 | 0 |
| `SentrySupportSQLiteOpenHelper.create` call sites | 1 | 0 |
| `io.sentry.gradle-plugin-integrations` in the shipped manifest | `AppStartInstrumentation,DatabaseInstrumentation,FileIOInstrumentation,LogcatInstrumentation` | absent |

```bash
# dex call sites
unzip -o -q app/build/outputs/apk/debug/app-debug.apk '*.dex' -d /tmp/dx
$ANDROID_HOME/build-tools/36.0.0/dexdump -d /tmp/dx/*.dex | grep -c 'SentrySQLiteDriver;.create'

# integrations reported to the SDK
$ANDROID_HOME/build-tools/36.0.0/aapt2 dump xmltree \
  --file AndroidManifest.xml app/build/outputs/apk/debug/app-debug.apk | grep -A1 gradle-plugin-integrations
```

The single `SentrySQLiteDriver.create` call site sits inside
`androidx.room3.RoomDatabase$Builder.setDriver`, which is exactly the rewrite SAGP performs.

A transaction is also on the scope in every worker thread (the app logs
`writer worker parent span: true`), so `SentrySQLiteStatement` is recording spans rather than
short-circuiting.

### FILE_IO instrumentation on Room's lock file — tested, not the cause

Room takes a multi-process file lock on the *first* open of a database
(`BaseRoomConnectionManager.openLocked` builds an `ExclusiveMutex` with `useFileLock = true` while
`isConfigured` is false). `androidx.room3.concurrent.FileLock.lock()` does:

```kotlin
lockChannel = FileOutputStream(lockFile).channel
lockChannel?.lock()
```

SAGP's `FILE_IO` feature rewrites that constructor, and `dexdump` confirms it happens in the
shipped APK, inside Room's own class:

```
0018: invoke-direct {v1, v0}, Ljava/io/FileOutputStream;.<init>:(Ljava/io/File;)V
001b: invoke-static  {v1, v0}, Lio/sentry/instrumentation/file/SentryFileOutputStream$Factory;.create:(...)
001f: invoke-virtual {v1}, Ljava/io/FileOutputStream;.getChannel:()Ljava/nio/channels/FileChannel;
0029: invoke-virtual {v1}, Ljava/nio/channels/FileChannel;.lock:()Ljava/nio/channels/FileLock;
```

`SentryFileOutputStream` calls `super(getFileDescriptor(delegate))`, so **two `FileOutputStream`
objects share one file descriptor**, the locking `FileChannel` hangs off the outer one, and
`close()` closes the inner one. That is on Room's non-cancellable open path, so it is worth
ruling out.

`FileLockProbe` replicates Room's `FileLock` verbatim so it receives the identical rewrite, and
`FirstOpenRace` drives Room's real locked open path under contention (each round builds a fresh
`RoomDatabase`, which resets `isConfigured`, then has N coroutines hit it simultaneously).

**Result: the lock is released correctly and the feature is not implicated.** Three runs per
configuration, 500 lock/unlock cycles + 60 rounds x 32 concurrent openers + the write burst.

Android 12, API 32:

| `-PsentryFeatures` | probe stream class | `OverlappingFileLockException` | first-open race, slowest round | write burst |
| --- | --- | --- | --- | --- |
| *(instrumentation off)* | `java.io.FileOutputStream` | 0 | 37 / 52 / 48 ms | 502 / 1039 / 622 ms |
| `DATABASE` | `java.io.FileOutputStream` | 0 | 5266* / 85 / 46 ms | 1462 / 658 / 577 ms |
| `FILE_IO` | `SentryFileOutputStream` | 0 | 50 / 37 / 21 ms | 463 / 505 / 349 ms |
| `DATABASE,FILE_IO` | `SentryFileOutputStream` | 0 | 56 / 47 / 38 ms | 570 / 632 / 559 ms |

API 36:

| `-PsentryFeatures` | probe stream class | `OverlappingFileLockException` | first-open race, slowest round | write burst |
| --- | --- | --- | --- | --- |
| *(instrumentation off)* | `java.io.FileOutputStream` | 0 | 103 / 79 / 88 ms | 539 / 531 / 583 ms |
| `DATABASE` | `java.io.FileOutputStream` | 0 | 123 / 146 / 151 ms | 715 / 750 / 718 ms |
| `FILE_IO` | `SentryFileOutputStream` | 0 | 102 / 56 / 64 ms | 581 / 573 / 557 ms |
| `DATABASE,FILE_IO` | `SentryFileOutputStream` | 0 | 159 / 165 / 191 ms | 731 / 788 / 779 ms |

\* That single 5266 ms round was chased and does not hold up: 8 repeats with identical parameters
gave 37-47 ms, 10 repeats of a lighter configuration gave 40-154 ms, and 4 runs from a fresh
install gave 43-68 ms. The same emulator also produced an unrelated 2531 ms burst outlier in a
different configuration, so these are host scheduling artefacts rather than an instrumentation
stall. It is left in the table because it was observed.

What this shows:

- **The file lock is really released.** `OverlappingFileLockException` is the decisive signal: a
  `FileLock` left in the JVM's lock table makes the *next* `lock()` on the same file fail
  immediately, even though the OS-level lock is gone. Over 500 sequential cycles with the wrapper
  active it never fired. `FileChannelImpl.implCloseChannel()` releases the lock table entries
  before it calls `parent.close()`, so the double-stream layout does not break it.
- **No file descriptor leak.** The `/proc/self/fd` delta across the probe is 7–9 at 300 cycles and
  7–9 at 2000 cycles, i.e. flat rather than per-cycle — it is background noise from other threads.
  `SentryFileOutputStream.close()` reaches `FileIOSpanManager.finish(delegate)`, which closes the
  real stream.
- **`FILE_IO` alone costs nothing here** — it is within noise of the uninstrumented baseline on
  both metrics.
- **The open-path cost comes from `DATABASE`**, ~60% on the first-open race. `DATABASE,FILE_IO` is
  modestly above `DATABASE` alone (159–191 vs 123–151 ms), so the two are mildly additive on the
  open path, but there is no pathological interaction: no hang, no lock leak, no failure.

Zero failures in every configuration, so this does not explain the reported timeout.

### Gotcha: app classes under `io.sentry.*` are never instrumented

The app package is `io.repro.issue5980`, deliberately. SAGP skips any class whose name starts with
`io.sentry` (`ClassContext.isSentryClass()`, with only `io.sentry.samples` and `io.sentry.mobile`
exempted). The first version of this reproduction used `io.repro.issue5980` and the
`FileLockProbe` was silently left uninstrumented — the dex showed a plain `FileOutputStream`
constructor with no `Factory.create` after it. The SQLite results were unaffected, because that
rewrite lands in the Room dependency rather than in app code.

### Notes for whoever picks this up

1. **The overhead is bounded by `maxSpans`.** `DriverSpans.record` calls `parent.startChild(...)`,
   and `SentryTracer.startChild` returns a no-op span once 1000 children exist. A DB-heavy app
   start therefore pays the instrumentation cost only for the first 1000 statements, which is why
   a slowdown large enough to exhaust a 30 second pool timeout looks unlikely.

2. **`SentrySQLiteStatement` captures a stack trace per statement on the main thread.**
   `DriverSpans.record` sets `SpanDataConvention.CALL_STACK_KEY` from
   `SentryStackTraceFactory.inAppCallStack` whenever `threadChecker.isMainThread` is true. This
   reproduction drives everything from `Dispatchers.IO`, so that path is never taken. An app that
   does Room work on the main thread during startup would pay it, and a slow device would pay far
   more than this emulator. That is worth measuring on real hardware before ruling it out.

3. **The reporter's own driver can block for 30 seconds by itself.** `PragmaConfiguringDriver`
   sets `PRAGMA busy_timeout = 30000` and then `PRAGMA journal_mode = WAL` on *every* connection
   it opens. Switching a database into WAL needs an exclusive lock, so on the very first launch —
   the only time the database is not in WAL yet — that PRAGMA can wait up to the busy timeout.
   Room's `ConnectionPoolImpl.Pool.acquire()` calls the connection factory *while already holding
   a pool permit*, so a connection that stalls inside `open()` holds its permit for the whole
   stall. With `capacity=1` on the writer pool, a second writer then hits exactly
   `Timed out attempting to acquire a writer connection.` after Room's own 30 second timeout.
   This matches "occurs during the initial app startup" and "almost every time on affected
   devices" (a slow device widens the race). It is a race, so it did not trigger on the emulator.

4. **`markRecycled()` throwing leaks a permit.** In `ConnectionPoolImpl.useConnection`, the
   `finally` block runs `usedConnection.markRecycled()` before `pool.recycle(...)`. `markRecycled`
   issues a `ROLLBACK TRANSACTION` when the connection is still in a transaction. If that throws,
   `pool.recycle` is never reached and the permit is lost for the lifetime of the pool — which
   produces `permits=0` forever. Worth checking whether any Sentry wrapper can make a statement on
   that path throw.

Room's pool logs the timeout with `printStackTrace` and then retries (`onTimeout` defaults to
`LOG_TIMEOUT_EXCEPTION`), so the message shows up in logcat under the `System.err` tag rather than
as a crash. The app's own closing log line deliberately avoids quoting Room's message verbatim, so
that grepping logcat for it cannot match the reproduction's own output.

## Environment

- Sentry Android SDK: 8.53.0
- Sentry Android Gradle Plugin: 6.19.0
- Room 3: 3.0.1, androidx.sqlite: 2.7.0 (`BundledSQLiteDriver`)
- AGP 9.2.1, Gradle 9.6.1, Kotlin 2.3.21, JDK 17
- Tested on an Android 12 / API 32 arm64 emulator (matching the report's platform) and on an
  API 36 arm64 emulator; the report is from Xiaomi devices on Android 12
