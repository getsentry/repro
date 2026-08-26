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
   adb shell pm clear io.sentry.repro.issue5980
   adb logcat -c
   adb shell am start -n io.sentry.repro.issue5980/.MainActivity \
     --ei writers 16 --ei readers 16 --ei ops 200
   adb logcat -d | grep -E "Repro5980|Timed out attempting"
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
| `--ei writers` | intent extra | `8` | concurrent coroutines that insert |
| `--ei readers` | intent extra | `8` | concurrent coroutines that query |
| `--ei ops` | intent extra | `60` | operations per worker |
| `--ez warmup` | intent extra | `false` | when `false`, the burst races Room's first open |

The DSN is empty by default. `export SENTRY_DSN=...` before building to send the data to a real
project. Without it the app falls back to `https://key@127.0.0.1/1`: the DSN must stay
syntactically valid, because an empty DSN disables the SDK and then
`SentrySQLiteStatement` records no span at all and the instrumentation becomes a no-op.
The envelopes simply fail to be delivered.

## Expected Behavior

Room's writer connection is acquired and released normally. No pool timeout.

## Actual Behavior

**The writer timeout did NOT reproduce here.** The harness runs, the instrumentation is confirmed
active, but the writer pool never times out. Numbers from a Pixel-class emulator (API 36,
16 writers x 200 inserts + 16 readers x 200 queries against two Room 3 databases, cold database
on every run):

| SAGP instrumentation | run 1 | run 2 | run 3 | pool timeouts |
| --- | --- | --- | --- | --- |
| on | 3914 ms | 4100 ms | 5049 ms | 0 |
| off | 3924 ms | 4302 ms | 4984 ms | 0 |

So on this hardware the instrumentation adds no measurable cost and does not starve the writer
pool. Read the notes below before treating this reproduction as a negative result for the SDK.

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
as a crash.

## Environment

- Sentry Android SDK: 8.53.0
- Sentry Android Gradle Plugin: 6.19.0
- Room 3: 3.0.1, androidx.sqlite: 2.7.0 (`BundledSQLiteDriver`)
- AGP 9.2.1, Gradle 9.6.1, Kotlin 2.3.21, JDK 17
- Tested on an API 36 emulator; the report is from Xiaomi devices on Android 12
