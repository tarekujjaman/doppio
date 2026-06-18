package com.doppio.core.network.dto

import kotlinx.serialization.Serializable

/** Standard error envelope: { "error": { "code": "...", "message": "..." } }. */
@Serializable
data class ApiErrorDto(
    val error: ApiErrorBody? = null,
)

@Serializable
data class ApiErrorBody(
    val code: String? = null,
    val message: String? = null,
)
