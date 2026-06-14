package com.doppio.core.capture

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.content.ContextCompat

/**
 * Microphone foreground service: keeps the app process (and mic access) alive so a
 * recording continues when the screen turns off or the app is backgrounded. The
 * actual capture lives in the singleton [RecorderController]; this service only holds
 * the foreground/microphone state and shows the ongoing "Recording…" notification.
 */
class RecordingService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = CaptureNotifications.recordingNotification(this)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                CaptureNotifications.RECORDING_NOTIF_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
            )
        } else {
            startForeground(CaptureNotifications.RECORDING_NOTIF_ID, notification)
        }
        return START_STICKY
    }

    companion object {
        fun start(context: Context) {
            ContextCompat.startForegroundService(context, Intent(context, RecordingService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, RecordingService::class.java))
        }
    }
}
