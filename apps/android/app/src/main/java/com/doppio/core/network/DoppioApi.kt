package com.doppio.core.network

import com.doppio.core.network.dto.HealthDto
import com.doppio.core.network.dto.IngestRequestDto
import com.doppio.core.network.dto.IngestResponseDto
import com.doppio.core.network.dto.MeDto
import com.doppio.core.network.dto.SessionDetailResponseDto
import com.doppio.core.network.dto.SessionsResponseDto
import com.doppio.core.network.dto.UploadUrlRequestDto
import com.doppio.core.network.dto.UploadUrlResponseDto
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Doppio REST API (grows per milestone). Auth'd endpoints rely on the Bearer token
 * attached by AuthInterceptor; ask/billing/mutations land in A5–A7.
 */
interface DoppioApi {
    @GET("api/health")
    suspend fun health(): HealthDto

    @GET("api/me")
    suspend fun me(): MeDto

    @GET("api/sessions")
    suspend fun listSessions(
        @Query("query") query: String? = null,
        @Query("cursor") cursor: String? = null,
        @Query("take") take: Int? = null,
    ): SessionsResponseDto

    @GET("api/sessions/{id}")
    suspend fun getSession(@Path("id") id: String): SessionDetailResponseDto

    @POST("api/sessions/upload-url")
    suspend fun createUploadUrl(@Body body: UploadUrlRequestDto): UploadUrlResponseDto

    @POST("api/sessions/{id}/ingest")
    suspend fun ingest(@Path("id") id: String, @Body body: IngestRequestDto): IngestResponseDto
}
