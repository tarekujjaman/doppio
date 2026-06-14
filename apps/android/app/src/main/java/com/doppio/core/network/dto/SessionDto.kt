package com.doppio.core.network.dto

import kotlinx.serialization.Serializable

/** GET /api/sessions — list item. */
@Serializable
data class SessionSummaryDto(
    val id: String,
    val title: String = "Untitled session",
    val source: String = "UPLOAD",
    val status: String = "UPLOADED",
    val language: String? = null,
    val durationSec: Int? = null,
    val tags: List<String> = emptyList(),
    val createdAt: String,
)

@Serializable
data class SessionsResponseDto(
    val sessions: List<SessionSummaryDto> = emptyList(),
    val nextCursor: String? = null,
)

/** GET /api/sessions/{id} — full detail (wrapped in `{ "session": … }`). */
@Serializable
data class SessionDetailResponseDto(
    val session: SessionDto,
)

@Serializable
data class SessionDto(
    val id: String,
    val title: String = "Untitled session",
    val source: String = "UPLOAD",
    val status: String = "UPLOADED",
    val language: String? = null,
    val durationSec: Int? = null,
    val audioKey: String? = null,
    val privateMode: Boolean = false,
    val hasAudio: Boolean = false,
    val tags: List<String> = emptyList(),
    val createdAt: String,
    val updatedAt: String? = null,
    val transcript: List<TranscriptSegmentDto> = emptyList(),
    val summary: SummaryDto? = null,
    val actionItems: List<ActionItemDto> = emptyList(),
    val notes: List<NoteDto> = emptyList(),
)

@Serializable
data class TranscriptSegmentDto(
    val id: String,
    val idx: Int,
    val startMs: Int,
    val endMs: Int,
    val text: String,
    val speaker: String? = null,
)

@Serializable
data class SummaryDto(
    val overview: String,
    val decisions: String? = null,
    val nextSteps: String? = null,
    val language: String = "en",
)

@Serializable
data class ActionItemDto(
    val id: String,
    val text: String,
    val owner: String? = null,
    val dueHint: String? = null,
    val done: Boolean = false,
)

@Serializable
data class NoteDto(
    val id: String,
    val anchorMs: Int? = null,
    val text: String,
    val createdAt: String,
    val updatedAt: String? = null,
)
