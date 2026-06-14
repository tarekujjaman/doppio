package com.doppio.core.network

import com.doppio.core.network.dto.HealthDto
import retrofit2.http.GET

/**
 * Doppio REST API (grows per milestone). A0 wires only the public health probe to
 * prove connectivity; auth'd endpoints (sessions, ask, billing…) land in A1–A7.
 */
interface DoppioApi {
    @GET("api/health")
    suspend fun health(): HealthDto
}
