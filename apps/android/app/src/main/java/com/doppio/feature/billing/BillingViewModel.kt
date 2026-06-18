package com.doppio.feature.billing

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.doppio.core.data.AccountRepository
import com.doppio.core.network.ApiResult
import com.doppio.core.network.dto.BillingDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class BillingViewModel @Inject constructor(
    private val repo: AccountRepository,
) : ViewModel() {

    data class UiState(
        val billing: BillingDto? = null,
        val loading: Boolean = true,
        val busy: Boolean = false,
        val message: String? = null,
        val checkoutUrl: String? = null,
    )

    private val _ui = MutableStateFlow(UiState())
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    init { refresh() }

    fun refresh() {
        _ui.update { it.copy(loading = true, message = null) }
        viewModelScope.launch {
            when (val r = repo.billing()) {
                is ApiResult.Success -> _ui.update { it.copy(loading = false, billing = r.data) }
                is ApiResult.Failure -> _ui.update { it.copy(loading = false, message = r.message) }
            }
        }
    }

    fun upgrade() {
        if (_ui.value.busy) return
        _ui.update { it.copy(busy = true, message = null) }
        viewModelScope.launch {
            when (val r = repo.checkout()) {
                is ApiResult.Success -> _ui.update { it.copy(busy = false, checkoutUrl = r.data.paymentUrl) }
                is ApiResult.Failure -> _ui.update { it.copy(busy = false, message = r.message) }
            }
        }
    }

    fun cancel() {
        if (_ui.value.busy) return
        _ui.update { it.copy(busy = true, message = null) }
        viewModelScope.launch {
            when (val r = repo.cancel()) {
                is ApiResult.Success -> { _ui.update { it.copy(busy = false) }; refresh() }
                is ApiResult.Failure -> _ui.update { it.copy(busy = false, message = r.message) }
            }
        }
    }

    fun checkoutOpened() = _ui.update { it.copy(checkoutUrl = null) }
}
