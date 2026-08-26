package io.sentry.repro.issue5980

import android.content.Context
import androidx.room3.Dao
import androidx.room3.Database
import androidx.room3.Entity
import androidx.room3.ExperimentalRoomApi
import androidx.room3.Insert
import androidx.room3.PrimaryKey
import androidx.room3.Query
import androidx.room3.Room
import androidx.room3.RoomDatabase
import androidx.sqlite.SQLiteConnection
import androidx.sqlite.SQLiteDriver
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import androidx.sqlite.execSQL

@Entity(tableName = "items")
data class Item(@PrimaryKey(autoGenerate = true) val id: Long = 0, val payload: String)

@Dao
interface ItemDao {
  @Insert suspend fun insert(item: Item): Long

  @Query("SELECT COUNT(*) FROM items") suspend fun count(): Int

  @Query("SELECT * FROM items ORDER BY id DESC LIMIT 20") suspend fun latest(): List<Item>
}

@Database(entities = [Item::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
  abstract fun itemDao(): ItemDao

  companion object {
    const val DATABASE_NAME = "app.db"
  }
}

@Entity(tableName = "events")
data class Event(@PrimaryKey(autoGenerate = true) val id: Long = 0, val payload: String)

@Dao
interface EventDao {
  @Insert suspend fun insert(event: Event): Long

  @Query("SELECT COUNT(*) FROM events") suspend fun count(): Int
}

@Database(entities = [Event::class], version = 1, exportSchema = false)
abstract class EventDatabase : RoomDatabase() {
  abstract fun eventDao(): EventDao

  companion object {
    const val DATABASE_NAME = "event.db"
  }
}

/**
 * Verbatim from the issue report: a user-supplied [SQLiteDriver] that wraps [BundledSQLiteDriver]
 * and applies PRAGMAs to every connection it opens.
 *
 * SAGP rewrites `RoomDatabase.Builder.setDriver(driver)` into
 * `setDriver(SentrySQLiteDriver.create(driver))`, so at runtime the chain is:
 *
 *     SentrySQLiteDriver -> PragmaConfiguringDriver -> BundledSQLiteDriver
 */
class PragmaConfiguringDriver(
  private val context: Context,
  private val delegate: SQLiteDriver,
  private val highPerformance: Boolean,
  private val fullSync: Boolean,
) : SQLiteDriver {

  override val hasConnectionPool: Boolean
    get() = delegate.hasConnectionPool

  override fun open(fileName: String): SQLiteConnection {
    val actualPath =
      if (fileName == ":memory:" || fileName.contains("/")) {
        fileName
      } else {
        context.getDatabasePath(fileName).absolutePath
      }

    val connection = delegate.open(actualPath)

    connection.execSQL("PRAGMA busy_timeout = 30000")
    connection.execSQL("PRAGMA foreign_keys = ON")
    connection.execSQL("PRAGMA journal_mode = WAL")
    connection.execSQL("PRAGMA temp_store = MEMORY")
    connection.execSQL("PRAGMA synchronous = ${if (fullSync) "FULL" else "NORMAL"}")

    if (highPerformance) {
      connection.execSQL("PRAGMA cache_size = -4000")
      connection.execSQL("PRAGMA journal_size_limit = 8388608")
    } else {
      connection.execSQL("PRAGMA cache_size = -2000")
      connection.execSQL("PRAGMA journal_size_limit = 4194304")
    }

    return connection
  }
}

@OptIn(ExperimentalRoomApi::class)
object Databases {

  @Volatile private var app: AppDatabase? = null
  @Volatile private var event: EventDatabase? = null

  fun app(context: Context): AppDatabase =
    app
      ?: synchronized(this) {
        app
          ?: Room.databaseBuilder(
              context = context,
              klass = AppDatabase::class.java,
              name = AppDatabase.DATABASE_NAME,
            )
            .setDriver(
              PragmaConfiguringDriver(
                context = context,
                delegate = BundledSQLiteDriver(),
                highPerformance = true,
                fullSync = false,
              )
            )
            .build()
            .also { app = it }
      }

  fun event(context: Context): EventDatabase =
    event
      ?: synchronized(this) {
        event
          ?: Room.databaseBuilder(
              context = context,
              klass = EventDatabase::class.java,
              name = EventDatabase.DATABASE_NAME,
            )
            .setDriver(
              PragmaConfiguringDriver(
                context = context,
                delegate = BundledSQLiteDriver(),
                highPerformance = false,
                fullSync = false,
              )
            )
            .build()
            .also { event = it }
      }
}
