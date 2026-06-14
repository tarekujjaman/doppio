package com.doppio.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.doppio.core.auth.AuthRepository
import com.doppio.core.data.SessionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class AuthGate { Loading, SignedOut, SignedIn }

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val sessionRepository: SessionRepository,
) : ViewModel() {

    /** Drives the root screen: restored session → SignedIn without any UI flash. */
    val gate: StateFlow<AuthGate> = authRepository.sessionStatus
        .map { status ->
            when (status) {
                is SessionStatus.Authenticated -> AuthGate.SignedIn
                is SessionStatus.Initializing -> AuthGate.Loading
                else -> AuthGate.SignedOut
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AuthGate.Loading)

    data class FormState(
        val step: Step = Step.Email,
        val email: String = "",
        val code: String = "",
        val busy: Boolean = false,
        val error: String? = null,
    ) {
        enum class Step { Email, Code }
    }

    private val _form = MutableStateFlow(FormState())
    val form: StateFlow<FormState> = _form.asStateFlow()

    fun onEmailChange(value: String) = _form.update { it.copy(email = value, error = null) }

    fun onCodeChange(value: String) =
        _form.update { it.copy(code = value.filter(Char::isDigit).take(6), error = null) }

    fun backToEmail() = _form.update { it.copy(step = FormState.Step.Email, code = "", error = null) }

    fun sendOtp() {
        val email = _form.value.email.trim()
        if (!email.contains("@")) {
            _form.update { it.copy(error = "Enter a valid email") }
            return
        }
        _form.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            runCatching { authRepository.sendEmailOtp(email) }
                .onSuccess { _form.update { it.copy(busy = false, step = FormState.Step.Code) } }
                .onFailure { e ->
                    _form.update { it.copy(busy = false, error = e.message ?: "Couldn't send the code") }
                }
        }
    }

    fun verifyOtp() {
        val state = _form.value
        if (state.code.length < 6) {
            _form.update { it.copy(error = "Enter the 6-digit code") }
            return
        }
        _form.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            runCatching { authRepository.verifyEmailOtp(state.email, state.code) }
                // success → sessionStatus flips to Authenticated → gate becomes SignedIn
                .onFailure { e ->
                    _form.update { it.copy(busy = false, error = e.message ?: "Invalid or expired code") }
                }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            runCatching {
                authRepository.signOut()
                sessionRepository.clearCache() // local cache must not outlive the session
            }
        }
    }
}
