plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.kotlin.android)
  alias(libs.plugins.ksp)
  alias(libs.plugins.sentry)
}

// Toggle the Sentry Android Gradle Plugin (SAGP) bytecode instrumentation:
//   ./gradlew :app:installDebug                               -> instrumentation ON  (bug case)
//   ./gradlew :app:installDebug -PsentryInstrumentation=false -> instrumentation OFF (baseline)
val instrumentationEnabled = (project.findProperty("sentryInstrumentation") ?: "true") == "true"

android {
  namespace = "io.sentry.repro.issue5980"
  compileSdk = 36

  defaultConfig {
    applicationId = "io.sentry.repro.issue5980"
    minSdk = 24
    targetSdk = 36
    versionCode = 1
    versionName = "1.0"
    buildConfigField("boolean", "SENTRY_INSTRUMENTATION", instrumentationEnabled.toString())
    // `export SENTRY_DSN=...` before building to send the data to a real project. The fallback
    // DSN is syntactically valid but unreachable: the SDK stays enabled (an empty DSN would
    // disable it, and then the SQLite instrumentation would never record a span) and the
    // envelopes simply fail to be delivered.
    val dsn = System.getenv("SENTRY_DSN") ?: "https://key@127.0.0.1/1"
    buildConfigField("String", "SENTRY_DSN", "\"$dsn\"")
  }

  buildTypes {
    getByName("debug") { isMinifyEnabled = false }
  }

  buildFeatures { buildConfig = true }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlin { compilerOptions.jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17 }
}

sentry {
  // The reproduction never uploads anything.
  autoUploadProguardMapping.set(false)
  includeProguardMapping.set(false)
  telemetry.set(false)

  tracingInstrumentation {
    // When enabled, SAGP rewrites `RoomDatabase.Builder.setDriver(driver)` into
    // `setDriver(SentrySQLiteDriver.create(driver))`.
    enabled.set(instrumentationEnabled)
  }
}

dependencies {
  implementation(libs.room3.runtime)
  ksp(libs.room3.compiler)
  implementation(libs.androidx.sqlite)
  implementation(libs.androidx.sqlite.bundled)
  implementation(libs.kotlinx.coroutines.android)

  implementation(libs.sentry.android)
  implementation(libs.sentry.android.sqlite)
}
