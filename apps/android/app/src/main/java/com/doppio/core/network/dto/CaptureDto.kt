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
