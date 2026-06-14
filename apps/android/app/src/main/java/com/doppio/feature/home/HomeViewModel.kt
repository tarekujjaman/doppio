package com.doppio.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.doppio.core.network.DoppioApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val api: DoppioApi,
) : ViewModel() {

    data class UiState(
        val loading: Boolean = true,
        val email: String? = null,
        val plan: String? = null,
        val health: String? = null,
        val error: String? = null,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.value = UiState(loading = true)
        viewModelScope.launch {
            try {
                val me = api.me() // authed round-trip (Bearer attached by interceptor)
                val health = runCatching { api.health() }.getOrNull()
                _state.value = UiState(
                    loading = false,
                    email = me.email,
                    plan = me.plan,
                    health = health?.let { "service ${it.service}, db ${it.db}" },
                )
            } catch (e: Exception) {
                _state.value = UiState(loading = false, error = e.message ?: e.javaClass.simpleName)
            }
        }
    }
}
