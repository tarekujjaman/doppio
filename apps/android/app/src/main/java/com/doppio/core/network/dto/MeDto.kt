package com.doppio.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class MeDto(
    val id: String,
    val email: String? = null,
    val name: String? = null,
    val locale: String = "en",
    val privateMode: Boolean = false,
    val plan: String = "FREE",
    val planExpiresAt: String? = null,
)
