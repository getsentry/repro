package io.repro.issue5980

import android.content.Context
import androidx.room3.ExperimentalRoomApi
import androidx.room3.Room
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import java.io.File
import kotlin.system.measureTimeMillis
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

/**
 * Drives Room's real `FileLock` under contention.
 *
 * `BaseRoomConnectionManager.openLocked` takes an [androidx.room3.concurrent.FileLock] while
 * `isConfigured` is still false, i.e. on the first open of a database. Every round below builds a
 * fresh `RoomDatabase` (which resets `isConfigured`) and then has [concurrency] coroutines hit it
 * at the same moment, so several pool connections race that locked open path at once.
 *
 * SAGP's FILE_IO instrumentation rewrites the `FileOutputStream` inside `FileLock.lock()`, and the
 * SQLite instrumentation wraps the driver on the same path, which is the combination under test.
 */
@OptIn(ExperimentalRoomApi::class)
class FirstOpenRace(
  private val context: Context,
  private val rounds: Int,
  private val concurrency: Int,
) {

  suspend fun run(log: suspend (String) -> Unit) {
    var failures = 0
    var slowestRound = 0L

    repeat(rounds) { round ->
      val db =
        Room.databaseBuilder(context, AppDatabase::class.java, "race-$round.db")
          .setDriver(
            PragmaConfiguringDriver(
              context = context,
              delegate = BundledSQLiteDriver(),
              highPerformance = true,
              fullSync = false,
            )
          )
          .build()

      val elapsed = measureTimeMillis {
        coroutineScope {
          (0 until concurrency)
            .map { worker ->
              async(Dispatchers.IO) {
                try {
                  // Readers and writers both race Room's locked first open.
                  if (worker % 2 == 0) {
                    db.itemDao().count()
                  } else {
                    db.itemDao().insert(Item(payload = "race-$round-$worker"))
                  }
                } catch (t: Throwable) {
                  failures++
                  log("first-open race failed: ${t::class.java.name}: ${t.message?.lineSequence()?.first()}")
                }
              }
            }
            .awaitAll()
        }
      }

      slowestRound = maxOf(slowestRound, elapsed)
      db.close()
      val dbFile = context.getDatabasePath("race-$round.db")
      dbFile.delete()
      File(dbFile.absolutePath + ".lck").delete()
    }

    log(
      "first-open race: $rounds rounds x $concurrency concurrent openers -> " +
        "slowest round ${slowestRound} ms, failures=$failures"
    )
  }
}
