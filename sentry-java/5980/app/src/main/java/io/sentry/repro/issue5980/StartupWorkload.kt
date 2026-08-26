package io.sentry.repro.issue5980

import android.content.Context
import io.sentry.Sentry
import io.sentry.TransactionOptions
import kotlin.system.measureTimeMillis
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext

/**
 * Mimics what the reporter describes: a burst of Room 3 database work on the first launch, while a
 * Sentry transaction is on the scope so that the SQLite instrumentation actually records spans.
 *
 * Room 3's default connection pool for a driver without its own pool is 4 readers and **1 writer**.
 * Every writer therefore queues behind the single writer connection, and Room aborts the wait after
 * 30 seconds with:
 *
 *     Timed out attempting to acquire a writer connection.
 */
class StartupWorkload(
  private val context: Context,
  private val writers: Int = 8,
  private val readers: Int = 8,
  private val opsPerWorker: Int = 60,
  /** When false, the burst itself races Room's first open / schema creation, like a cold start. */
  private val warmUp: Boolean = false,
) {

  suspend fun run(log: suspend (String) -> Unit): String {
    val report = StringBuilder()

    suspend fun emit(line: String) {
      report.appendLine(line)
      log(line)
    }

    emit("SAGP tracing instrumentation: ${BuildConfig.SENTRY_INSTRUMENTATION}")

    val transaction =
      Sentry.startTransaction(
        "startup",
        "app.start",
        TransactionOptions().apply { isBindToScope = true },
      )

    val appDb = Databases.app(context)
    val eventDb = Databases.event(context)

    emit("parent span on this thread: ${Sentry.getSpan() != null}")

    if (warmUp) {
      val openMs = measureTimeMillis {
        // First touch performs Room's open/create/migrate on the single writer connection.
        appDb.itemDao().count()
        eventDb.eventDao().count()
      }
      emit("open + create schema: ${openMs} ms")
    } else {
      emit("cold start: the burst below races Room's first open / schema creation")
    }

    var failures = 0

    val burstMs = measureTimeMillis {
      coroutineScope {
        val jobs =
          buildList<kotlinx.coroutines.Deferred<Unit>> {
            repeat(writers) { worker ->
              add(
                async(Dispatchers.IO) {
                  bindTransaction(transaction)
                  if (worker == 0) log("writer worker parent span: ${Sentry.getSpan() != null}")
                  repeat(opsPerWorker) { op ->
                    try {
                      appDb.itemDao().insert(Item(payload = "w$worker-$op"))
                      eventDb.eventDao().insert(Event(payload = "w$worker-$op"))
                    } catch (t: Throwable) {
                      failures++
                      log("write failed: ${t::class.java.name}: ${t.message?.lineSequence()?.first()}")
                    }
                  }
                }
              )
            }
            repeat(readers) { worker ->
              add(
                async(Dispatchers.IO) {
                  bindTransaction(transaction)
                  repeat(opsPerWorker) {
                    try {
                      appDb.itemDao().latest()
                      appDb.itemDao().count()
                    } catch (t: Throwable) {
                      failures++
                      log("read failed: ${t::class.java.name}: ${t.message?.lineSequence()?.first()}")
                    }
                  }
                }
              )
            }
          }
        jobs.awaitAll()
      }
    }

    emit(
      "burst: ${writers} writers x ${opsPerWorker} inserts + " +
        "${readers} readers x ${opsPerWorker} queries -> ${burstMs} ms, failures=$failures"
    )
    emit("rows in items: ${appDb.itemDao().count()}")

    transaction.finish()

    emit("")
    emit("Check logcat for: 'Timed out attempting to acquire a writer connection.'")
    return report.toString()
  }

  private suspend fun bindTransaction(transaction: io.sentry.ITransaction) =
    withContext(Dispatchers.Unconfined) {
      // Sentry forks scopes per thread; make sure this worker thread really sees a parent span,
      // otherwise SentrySQLiteStatement short-circuits and records nothing.
      Sentry.configureScope { it.transaction = transaction }
    }
}
