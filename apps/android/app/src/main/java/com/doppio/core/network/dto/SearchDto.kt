package com.doppio.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class SearchHitDto(
    val sessionId: String,
    val sessionTitle: String = "",
    val kind: String = "segment", // "title" | "segment" | "note"
    val startMs: Int? = null,
    val snippet: String = "",
)

@Serializable
data class SearchResponseDto(
    val query: String = "",
    val hits: List<SearchHitDto> = emptyList(),
)
