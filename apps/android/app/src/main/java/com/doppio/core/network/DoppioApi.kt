package com.doppio.core.network

import com.doppio.core.network.dto.HealthDto
import com.doppio.core.network.dto.MeDto
import retrofit2.http.GET

/**
 * Doppio REST API (grows per milestone). Auth'd endpoints rely on the Bearer token
 * attached by AuthInterceptor; sessions/ask/billing land in A2–A7.
 */
interface DoppioApi {
    @GET("api/health")
    suspend fun health(): HealthDto

    @GET("api/me")
    suspend fun me(): MeDto
}
