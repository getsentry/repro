package com.example.camerareplayrepro

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import com.example.camerareplayrepro.databinding.ActivityMainBinding
import io.sentry.Sentry
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * This activity demonstrates the issue where CameraX preview content
 * is not properly masked in Sentry Session Replay.
 *
 * EXPECTED BEHAVIOR:
 * - Camera preview should be masked/blacked out in the replay
 * - User's camera content should NOT be visible in Sentry
 *
 * ACTUAL BEHAVIOR (reported):
 * - Camera preview content may be visible in the replay
 * - This is a privacy concern as camera content could be captured
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var cameraExecutor: ExecutorService

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            startCamera()
        } else {
            Toast.makeText(this, "Camera permission required", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        cameraExecutor = Executors.newSingleThreadExecutor()

        // Request camera permission
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            startCamera()
        } else {
            requestPermissionLauncher.launch(Manifest.permission.CAMERA)
        }

        // Button to trigger a crash for testing replay
        binding.crashButton.setOnClickListener {
            Log.d("CameraRepro", "Triggering crash to test replay...")
            // Capture an error to trigger replay upload
            Sentry.captureException(RuntimeException("Test crash while camera is active"))
            Toast.makeText(this, "Error captured! Check Sentry for replay.", Toast.LENGTH_LONG).show()
        }

        // Button to trigger a fatal crash
        binding.fatalCrashButton.setOnClickListener {
            Log.d("CameraRepro", "Triggering fatal crash...")
            throw RuntimeException("Fatal crash while camera preview is showing - check if camera content is masked in replay!")
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)

        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            // Set up the preview use case
            val preview = Preview.Builder()
                .build()
                .also {
                    it.setSurfaceProvider(binding.previewView.surfaceProvider)
                }

            // Select back camera
            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                // Unbind any existing use cases
                cameraProvider.unbindAll()

                // Bind the camera to the lifecycle
                cameraProvider.bindToLifecycle(
                    this,
                    cameraSelector,
                    preview
                )

                Log.d("CameraRepro", "Camera started successfully")

            } catch (e: Exception) {
                Log.e("CameraRepro", "Failed to bind camera", e)
                Sentry.captureException(e)
            }

        }, ContextCompat.getMainExecutor(this))
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}
