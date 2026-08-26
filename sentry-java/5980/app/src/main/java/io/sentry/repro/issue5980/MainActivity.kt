package io.sentry.repro.issue5980

import android.app.Activity
import android.os.Bundle
import android.util.Log
import android.widget.ScrollView
import android.widget.TextView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

const val TAG = "Repro5980"

class MainActivity : Activity() {

  private lateinit var output: TextView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    output = TextView(this).apply { setPadding(24, 24, 24, 24) }
    setContentView(ScrollView(this).apply { addView(output) })

    // adb shell am start -n io.sentry.repro.issue5980/.MainActivity \
    //   --ei writers 8 --ei readers 8 --ei ops 60
    val workload =
      StartupWorkload(
        context = applicationContext,
        writers = intent.getIntExtra("writers", 8),
        readers = intent.getIntExtra("readers", 8),
        opsPerWorker = intent.getIntExtra("ops", 60),
        warmUp = intent.getBooleanExtra("warmup", false),
      )

    CoroutineScope(Dispatchers.Default).launch {
      val report = workload.run { line -> log(line) }
      withContext(Dispatchers.Main) { output.text = report }
    }
  }

  private suspend fun log(line: String) {
    Log.i(TAG, line)
    withContext(Dispatchers.Main) { output.append(line + "\n") }
  }
}
