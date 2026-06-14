package com.doppio.core.ui

/** Shared helpers for the server session status string. */
object SessionStatuses {
    private val IN_FLIGHT = setOf("RECORDING", "UPLOADED", "TRANSCRIBING", "SUMMARIZING")

    fun isInFlight(status: String): Boolean = status in IN_FLIGHT
    fun isReady(status: String): Boolean = status == "READY"
    fun isFailed(status: String): Boolean = status == "FAILED"

    fun label(status: String): String = when (status) {
        "READY" -> "Ready"
        "FAILED" -> "Failed"
        "TRANSCRIBING" -> "Transcribing…"
        "SUMMARIZING" -> "Summarizing…"
        "UPLOADED" -> "Queued…"
        "RECORDING" -> "Recording…"
        else -> status
    }
}

/** mm:ss from seconds, for durations. */
fun formatDuration(seconds: Int?): String {
    if (seconds == null || seconds <= 0) return "—"
    val m = seconds / 60
    val s = seconds % 60
    return "%d:%02d".format(m, s)
}

/** ISO-8601 → yyyy-MM-dd (no date lib needed). */
fun shortDate(iso: String): String = iso.take(10)
