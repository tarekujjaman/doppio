package com.doppio.core.capture

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

object CaptureNotifications {
    const val CHANNEL_ID = "capture"
    const val RECORDING_NOTIF_ID = 4202
    private const val DONE_NOTIF_ID = 4201

    const val EXTRA_NAVIGATE = "navigateTo"
    const val NAV_CAPTURE = "capture"

    /** PendingIntent that opens the app and navigates to [route] (a NavHost route
     *  such as "capture" or "session/<id>"). */
    private fun navIntent(context: Context, route: String, requestCode: Int): PendingIntent {
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            putExtra(EXTRA_NAVIGATE, route)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        return PendingIntent.getActivity(
            context, requestCode, launch,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }

    /** Ongoing notification shown while the mic foreground service records.
     *  Tapping it opens the app on the live recording so it can be stopped. */
    fun recordingNotification(context: Context): Notification {
        ensureChannel(context)
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Recording…")
            .setContentText("Doppio is recording — tap to stop")
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(navIntent(context, NAV_CAPTURE, requestCode = 1))
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = context.getSystemService(NotificationManager::class.java)
            if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
                mgr.createNotificationChannel(
                    NotificationChannel(
                        CHANNEL_ID,
                        "Transcriptions",
                        NotificationManager.IMPORTANCE_DEFAULT,
                    ),
                )
            }
        }
    }

    /**
     * Best-effort: no-op if POST_NOTIFICATIONS isn't granted (API 33+).
     * [detail] surfaces the underlying error on failure so a stuck upload is
     * diagnosable from the phone (shown expanded via BigTextStyle).
     */
    fun notifyDone(
        context: Context,
        title: String,
        ready: Boolean,
        detail: String? = null,
        sessionId: String? = null,
    ) {
        ensureChannel(context)
        val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.POST_NOTIFICATIONS,
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!granted) return

        val body = if (detail.isNullOrBlank()) title else "$title — $detail"
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_upload_done)
            .setContentTitle(if (ready) "Session ready" else "Transcription failed")
            .setContentText(body)
            .setAutoCancel(true)
        if (!detail.isNullOrBlank()) {
            builder.setStyle(NotificationCompat.BigTextStyle().bigText(body))
        }
        // Tapping opens the app straight to that session's workspace.
        if (sessionId != null) {
            builder.setContentIntent(navIntent(context, "session/$sessionId", requestCode = 2))
        }
        runCatching { NotificationManagerCompat.from(context).notify(DONE_NOTIF_ID, builder.build()) }
    }
}
