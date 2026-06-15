package com.doppio.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class UploadUrlRequestDto(
    val filename: String,
    val contentType: String,
    val sizeBytes: Long,
    val durationSec: Int? = null,
    val source: String = "MOBILE",
    val title: String? = null,
    val privateMode: Boolean? = null,
)

@Serializable
data class UploadUrlResponseDto(
    val sessionId: String,
    val bucket: String,
    val path: String,
    val token: String,
)

@Serializable
data class IngestRequestDto(
    val durationSec: Int? = null,
)

@Serializable
data class IngestResponseDto(
    val ok: Boolean = true,
    val status: String = "TRANSCRIBING",
)

// Live (near-real-time) capture: start → transcribe-chunk (while recording) → finalize.
// `source` has no default so kotlinx always serializes it (default-valued fields are omitted).
@Serializable
data class StartLiveRequestDto(
    val source: String,
    val title: String? = null,
    val privateMode: Boolean? = null,
)

@Serializable
data class StartLiveResponseDto(val sessionId: String)

@Serializable
data class FinalizeRequestDto(val durationSec: Int? = null)

@Serializable
data class FinalizeResponseDto(val status: String? = null, val ok: Boolean = true)
