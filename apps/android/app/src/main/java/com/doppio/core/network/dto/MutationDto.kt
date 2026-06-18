package com.doppio.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class OkDto(val ok: Boolean = true)

@Serializable
data class UpdateSessionDto(
    val title: String? = null,
    val tags: List<String>? = null,
)

@Serializable
data class UpdateActionItemDto(
    val done: Boolean? = null,
    val text: String? = null,
)

@Serializable
data class AddNoteDto(
    val text: String,
    val anchorMs: Int? = null,
)

@Serializable
data class NoteResponseDto(val note: NoteDto)

@Serializable
data class RegenerateSummaryResponseDto(val summary: SummaryDto)

@Serializable
data class AudioUrlDto(val url: String)
