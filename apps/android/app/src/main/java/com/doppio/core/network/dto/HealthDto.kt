package com.doppio.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class HealthDto(
    val ok: Boolean = false,
    val service: String? = null,
    val db: Boolean? = null,
)
