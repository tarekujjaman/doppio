package com.doppio.core.network

import com.doppio.core.network.dto.AddNoteDto
import com.doppio.core.network.dto.AudioUrlDto
import com.doppio.core.network.dto.BillingDto
import com.doppio.core.network.dto.CancelResponseDto
import com.doppio.core.network.dto.CheckoutRequestDto
import com.doppio.core.network.dto.CheckoutResponseDto
import com.doppio.core.network.dto.HealthDto
import com.doppio.core.network.dto.IngestRequestDto
import com.doppio.core.network.dto.IngestResponseDto
import com.doppio.core.network.dto.MeDto
import com.doppio.core.network.dto.NoteResponseDto
import com.doppio.core.network.dto.OkDto
import com.doppio.core.network.dto.RegenerateSummaryResponseDto
import com.doppio.core.network.dto.SearchResponseDto
import com.doppio.core.network.dto.SessionDetailResponseDto
import com.doppio.core.network.dto.SessionsResponseDto
import com.doppio.core.network.dto.UpdateActionItemDto
import com.doppio.core.network.dto.UpdateMeDto
import com.doppio.core.network.dto.UpdateSessionDto
import com.doppio.core.network.dto.UploadUrlRequestDto
import com.doppio.core.network.dto.UploadUrlResponseDto
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
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

    @PATCH("api/sessions/{id}")
    suspend fun updateSession(@Path("id") id: String, @Body body: UpdateSessionDto): OkDto

    @DELETE("api/sessions/{id}")
    suspend fun deleteSession(@Path("id") id: String): OkDto

    @PATCH("api/action-items/{id}")
    suspend fun updateActionItem(@Path("id") id: String, @Body body: UpdateActionItemDto): OkDto

    @POST("api/sessions/{id}/notes")
    suspend fun addNote(@Path("id") id: String, @Body body: AddNoteDto): NoteResponseDto

    @DELETE("api/notes/{id}")
    suspend fun deleteNote(@Path("id") id: String): OkDto

    @POST("api/sessions/{id}/regenerate-summary")
    suspend fun regenerateSummary(@Path("id") id: String): RegenerateSummaryResponseDto

    @GET("api/sessions/{id}/audio")
    suspend fun getAudioUrl(@Path("id") id: String): AudioUrlDto

    @GET("api/search")
    suspend fun search(
        @Query("q") q: String,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
    ): SearchResponseDto

    @GET("api/billing")
    suspend fun billing(): BillingDto

    @POST("api/billing/checkout")
    suspend fun checkout(@Body body: CheckoutRequestDto): CheckoutResponseDto

    @POST("api/billing/cancel")
    suspend fun cancelPlan(): CancelResponseDto

    @PATCH("api/me")
    suspend fun updateMe(@Body body: UpdateMeDto): OkDto

    @DELETE("api/me")
    suspend fun deleteAccount(): OkDto
}
