package com.doppio.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class BillingDto(
    val plan: String = "FREE",
    val planExpiresAt: String? = null,
    val usage: UsageDto = UsageDto(),
    val payments: List<PaymentDto> = emptyList(),
)

@Serializable
data class UsageDto(
    val transcribeMinutesThisMonth: Int = 0,
    val transcribeMinutesCap: Int = 0,
    val askCallsToday: Int = 0,
    val askCallsCap: Int = 0,
)

@Serializable
data class PaymentDto(
    val id: String,
    val provider: String = "",
    val amountBdt: Int = 0,
    val status: String = "",
    val plan: String = "",
    val createdAt: String = "",
)

@Serializable
data class CheckoutRequestDto(val plan: String = "PRO")

@Serializable
data class CheckoutResponseDto(val paymentId: String, val paymentUrl: String)

@Serializable
data class CancelResponseDto(
    val ok: Boolean = true,
    val activeUntil: String? = null,
    val message: String? = null,
)

@Serializable
data class UpdateMeDto(
    val name: String? = null,
    val locale: String? = null,
    val privateMode: Boolean? = null,
)
