package com.doppio.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class AskRequestDto(val question: String, val threadId: String? = null)

@Serializable
data class AskMetaDto(val threadId: String? = null)

@Serializable
data class AskDeltaDto(val text: String = "")

@Serializable
data class AskCitationDto(val segmentIdx: Int? = null, val startMs: Int? = null)

@Serializable
data class AskDoneDto(val citations: List<AskCitationDto> = emptyList())

@Serializable
data class AskErrorDto(val message: String = "")
