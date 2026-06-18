package com.doppio.core.data

import com.doppio.core.network.ApiResult
import com.doppio.core.network.DoppioApi
import com.doppio.core.network.dto.BillingDto
import com.doppio.core.network.dto.CheckoutRequestDto
import com.doppio.core.network.dto.CheckoutResponseDto
import com.doppio.core.network.dto.MeDto
import com.doppio.core.network.dto.UpdateMeDto
import com.doppio.core.network.safeApiCall
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AccountRepository @Inject constructor(
    private val api: DoppioApi,
    private val json: Json,
) {
    suspend fun billing(): ApiResult<BillingDto> = safeApiCall(json) { api.billing() }

    suspend fun profile(): ApiResult<MeDto> = safeApiCall(json) { api.me() }

    suspend fun checkout(): ApiResult<CheckoutResponseDto> =
        safeApiCall(json) { api.checkout(CheckoutRequestDto("PRO")) }

    suspend fun cancel(): ApiResult<Unit> =
        when (val r = safeApiCall(json) { api.cancelPlan() }) {
            is ApiResult.Success -> ApiResult.Success(Unit)
            is ApiResult.Failure -> r
        }

    suspend fun updateMe(name: String? = null, locale: String? = null, privateMode: Boolean? = null): ApiResult<Unit> =
        when (val r = safeApiCall(json) { api.updateMe(UpdateMeDto(name, locale, privateMode)) }) {
            is ApiResult.Success -> ApiResult.Success(Unit)
            is ApiResult.Failure -> r
        }

    suspend fun deleteAccount(): ApiResult<Unit> =
        when (val r = safeApiCall(json) { api.deleteAccount() }) {
            is ApiResult.Success -> ApiResult.Success(Unit)
            is ApiResult.Failure -> r
        }
}
