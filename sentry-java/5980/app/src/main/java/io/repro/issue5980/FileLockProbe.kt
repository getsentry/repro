package io.repro.issue5980

import java.io.File
import java.io.FileOutputStream
import java.nio.channels.FileChannel
import java.nio.channels.OverlappingFileLockException
import kotlin.system.measureTimeMillis

/**
 * Replicates `androidx.room3.concurrent.FileLock` verbatim so that SAGP's FILE_IO instrumentation
 * rewrites it the same way it rewrites Room's copy:
 *
 *     FileOutputStream(lockFile)                                   // real stream
 *     -> SentryFileOutputStream$Factory.create(stream, lockFile)   // injected
 *     -> .channel.lock()                                           // channel of the OUTER stream
 *
 * `SentryFileOutputStream` calls `super(getFileDescriptor(delegate))`, so two `FileOutputStream`
 * objects share one file descriptor, and the `FileChannel` that holds the lock hangs off the outer
 * one while `close()` closes the inner one. This probe checks whether the lock is still released.
 *
 * The interesting failure is [OverlappingFileLockException]: a `FileLock` that is not removed from
 * the JVM's lock table makes the *next* lock attempt on the same file fail immediately, even though
 * the OS-level lock is gone.
 */
class FileLockProbe(private val filename: String) {

  private var lockChannel: FileChannel? = null

  /** The runtime class of the stream, which tells us whether the rewrite actually happened. */
  var streamClass: String = "<not run>"
    private set

  fun lock() {
    if (lockChannel != null) {
      return
    }
    try {
      val lockFile = File("$filename.lck")
      lockFile.parentFile?.mkdirs()
      val stream = FileOutputStream(lockFile)
      streamClass = stream.javaClass.name
      lockChannel = stream.channel
      lockChannel?.lock()
    } catch (ex: Throwable) {
      lockChannel?.close()
      lockChannel = null
      throw IllegalStateException("Unable to lock file: '$filename.lck'.", ex)
    }
  }

  fun unlock() {
    val channel = lockChannel ?: return
    try {
      channel.close()
    } finally {
      lockChannel = null
    }
  }

  companion object {

    private fun openFds(): Int = File("/proc/self/fd").list()?.size ?: -1

    /**
     * Runs [cycles] lock/unlock round trips on the same file, exactly like Room does when it opens
     * a database for the first time.
     */
    fun run(dir: File, cycles: Int, log: (String) -> Unit) {
      val target = File(dir, "probe.db").absolutePath
      var overlapping = 0
      var otherFailures = 0
      var slowest = 0L
      var streamClass = "<not run>"

      val fdsBefore = openFds()

      repeat(cycles) { i ->
        val probe = FileLockProbe(target)
        val elapsed = measureTimeMillis {
          try {
            probe.lock()
            streamClass = probe.streamClass
            probe.unlock()
          } catch (t: Throwable) {
            var cause: Throwable? = t
            while (cause != null && cause !is OverlappingFileLockException) cause = cause.cause
            if (cause is OverlappingFileLockException) {
              overlapping++
              if (overlapping == 1) log("cycle $i: OverlappingFileLockException")
            } else {
              otherFailures++
              if (otherFailures == 1) log("cycle $i: ${t::class.java.name}: ${t.message}")
            }
            // Leave the probe locked exactly as Room would; the next cycle uses a new instance.
          }
        }
        slowest = maxOf(slowest, elapsed)
      }

      val fdsAfter = openFds()

      log("file lock probe: stream class = $streamClass")
      log(
        "file lock probe: $cycles cycles, overlapping=$overlapping, otherFailures=$otherFailures, " +
          "slowest=${slowest} ms"
      )
      log("file lock probe: open fds ${fdsBefore} -> ${fdsAfter} (leak = ${fdsAfter - fdsBefore})")
    }
  }
}
