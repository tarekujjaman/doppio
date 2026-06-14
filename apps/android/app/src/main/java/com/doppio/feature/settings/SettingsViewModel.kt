package com.doppio.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.doppio.core.auth.AuthRepository
import com.doppio.core.data.AccountRepository
import com.doppio.core.data.SessionRepository
import com.doppio.core.export.FileExporter
import com.doppio.core.network.ApiResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val account: AccountRepository,
    private val auth: AuthRepository,
    private val sessions: SessionRepository,
    private val exporter: FileExporter,
) : ViewModel() {

    data class UiState(
        val loading: Boolean = true,
        val email: String? = null,
        val name: String = "",
        val locale: String = "en",
        val privateMode: Boolean = false,
        val plan: String = "FREE",
        val busy: Boolean = false,
        val message: String? = null,
        val share: FileExporter.Shareable? = null,
    )

    private val _ui = MutableStateFlow(UiState())
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    init { load() }

    fun load() {
        _ui.update { it.copy(loading = true, message = null) }
        viewModelScope.launch {
            when (val r = account.profile()) {
                is ApiResult.Success -> _ui.update {
                    it.copy(
                        loading = false,
                        email = r.data.email,
                        name = r.data.name ?: "",
                        locale = r.data.locale,
                        privateMode = r.data.privateMode,
                        plan = r.data.plan,
                    )
                }
                is ApiResult.Failure -> _ui.update { it.copy(loading = false, message = r.message) }
            }
        }
    }

    fun onNameChange(value: String) = _ui.update { it.copy(name = value) }

    fun saveName() = patch { account.updateMe(name = _ui.value.name.trim()) }

    fun setLocale(locale: String) {
        _ui.update { it.copy(locale = locale) }
        patch { account.updateMe(locale = locale) }
    }

    fun setPrivateMode(enabled: Boolean) {
        _ui.update { it.copy(privateMode = enabled) }
        patch { account.updateMe(privateMode = enabled) }
    }

    /** Set/change the account password (lets magic-link users enable password sign-in). */
    fun setPassword(newPassword: String) {
        if (newPassword.length < 6) {
            _ui.update { it.copy(message = "Password must be at least 6 characters") }
            return
        }
        if (_ui.value.busy) return
        _ui.update { it.copy(busy = true, message = null) }
        viewModelScope.launch {
            runCatching { auth.updatePassword(newPassword) }
                .onSuccess { _ui.update { it.copy(busy = false, message = "Password saved — you can now sign in with it.") } }
                .onFailure { e -> _ui.update { it.copy(busy = false, message = e.message ?: "Couldn't set password") } }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            runCatching {
                auth.signOut()
                sessions.clearCache()
            }
        }
    }

    fun deleteAccount() {
        if (_ui.value.busy) return
        _ui.update { it.copy(busy = true, message = null) }
        viewModelScope.launch {
            when (val r = account.deleteAccount()) {
                is ApiResult.Success -> {
                    sessions.clearCache()
                    auth.signOut() // gate flips to SignedOut
                }
                is ApiResult.Failure -> _ui.update { it.copy(busy = false, message = r.message) }
            }
        }
    }

    fun exportData() {
        if (_ui.value.busy) return
        _ui.update { it.copy(busy = true, message = null) }
        viewModelScope.launch {
            val share = exporter.exportMyData()
            _ui.update {
                it.copy(busy = false, share = share, message = if (share == null) "Export failed" else null)
            }
        }
    }

    fun clearShare() = _ui.update { it.copy(share = null) }

    fun clearMessage() = _ui.update { it.copy(message = null) }

    private fun patch(block: suspend () -> ApiResult<Unit>) {
        viewModelScope.launch {
            _ui.update { it.copy(busy = true) }
            val r = block()
            _ui.update { it.copy(busy = false, message = (r as? ApiResult.Failure)?.message) }
        }
    }
}
