package com.doppio.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class AskRequestDto(val question: String, val threadId: String? = null)

@Serializable
data class AskMetaDto(val threadId: String? = null)

@Serializable
data class AskDeltaDto(val text: String = "")

@Serializable
data class AskCitationDto(
    val segmentIdx: Int? = null,
    val startMs: Int? = null,
    // Global "Ask Doppio" citations also carry the source session + kind.
    val sessionId: String? = null,
    val sessionTitle: String? = null,
    val kind: String? = null,
)

@Serializable
data class AskDoneDto(val citations: List<AskCitationDto> = emptyList())

@Serializable
data class AskErrorDto(val message: String = "")

// GET /api/ask — resume the persisted global memory conversation.
@Serializable
data class AskMemoryMessageDto(
    val role: String = "assistant",
    val text: String = "",
    val citations: List<AskCitationDto> = emptyList(),
)

@Serializable
data class AskMemoryResponseDto(
    val threadId: String? = null,
    val messages: List<AskMemoryMessageDto> = emptyList(),
)
