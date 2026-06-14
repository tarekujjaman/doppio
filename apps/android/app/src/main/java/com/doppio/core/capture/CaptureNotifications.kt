package com.doppio.core.capture

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.doppio.R

object CaptureNotifications {
    const val CHANNEL_ID = "capture"
    private const val DONE_NOTIF_ID = 4201

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
    fun notifyDone(context: Context, title: String, ready: Boolean, detail: String? = null) {
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
        runCatching { NotificationManagerCompat.from(context).notify(DONE_NOTIF_ID, builder.build()) }
    }
}
