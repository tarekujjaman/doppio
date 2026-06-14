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

    sealed interface HealthState {
        data object Loading : HealthState
        data class Ok(val service: String, val db: Boolean) : HealthState
        data class Error(val message: String) : HealthState
    }

    private val _state = MutableStateFlow<HealthState>(HealthState.Loading)
    val state: StateFlow<HealthState> = _state.asStateFlow()

    init {
        checkHealth()
    }

    fun checkHealth() {
        _state.value = HealthState.Loading
        viewModelScope.launch {
            _state.value = try {
                val h = api.health()
                HealthState.Ok(service = h.service ?: "?", db = h.db ?: false)
            } catch (e: Exception) {
                HealthState.Error(e.message ?: e.javaClass.simpleName)
            }
        }
    }
}
