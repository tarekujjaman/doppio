package com.doppio.core.network

import com.doppio.core.network.dto.ApiErrorDto
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import java.io.IOException

enum class ApiErrorType {
    Unauthorized,   // 401 — token invalid even after refresh → reauth
    QuotaExceeded,  // 402 — plan/budget cap → upgrade prompt
    InvalidState,   // 409 — e.g. session not in expected status
    BadUpload,      // 413/415 — too large / unsupported type
    NotFound,       // 404
    Network,        // no connectivity / timeout
    Server,         // 5xx
    Unknown,
}

sealed interface ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>
    data class Failure(
        val type: ApiErrorType,
        val message: String,
        val code: String? = null,
        val httpCode: Int? = null,
    ) : ApiResult<Nothing>
}

/** Runs a Retrofit call and normalizes failures into [ApiResult.Failure]. */
suspend fun <T> safeApiCall(json: Json, block: suspend () -> T): ApiResult<T> =
    try {
        ApiResult.Success(block())
    } catch (e: HttpException) {
        val body = runCatching { e.response()?.errorBody()?.string() }.getOrNull()
        val parsed = body?.takeIf { it.isNotBlank() }
            ?.let { runCatching { json.decodeFromString<ApiErrorDto>(it) }.getOrNull() }
        val apiCode = parsed?.error?.code
        val message = parsed?.error?.message ?: "Request failed (${e.code()})"
        ApiResult.Failure(mapErrorType(e.code(), apiCode), message, apiCode, e.code())
    } catch (e: IOException) {
        ApiResult.Failure(ApiErrorType.Network, "Network unavailable — check your connection")
    } catch (e: Exception) {
        ApiResult.Failure(ApiErrorType.Unknown, e.message ?: "Unexpected error")
    }

/** Maps (HTTP status, API error code) → a typed error. Pure, so unit-testable directly. */
fun mapErrorType(httpCode: Int, apiCode: String?): ApiErrorType = when {
    httpCode == 401 -> ApiErrorType.Unauthorized
    httpCode == 402 || apiCode == "QUOTA_EXCEEDED" || apiCode == "BUDGET_EXCEEDED" -> ApiErrorType.QuotaExceeded
    httpCode == 409 || apiCode == "INVALID_STATE" -> ApiErrorType.InvalidState
    httpCode == 413 || httpCode == 415 || apiCode == "FILE_TOO_LARGE" || apiCode == "UNSUPPORTED_TYPE" -> ApiErrorType.BadUpload
    httpCode == 404 -> ApiErrorType.NotFound
    httpCode in 500..599 -> ApiErrorType.Server
    else -> ApiErrorType.Unknown
}
