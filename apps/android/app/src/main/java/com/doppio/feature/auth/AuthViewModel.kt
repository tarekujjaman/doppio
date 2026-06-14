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
        val busy: Boolean = false,
        val error: String? = null,
    ) {
        enum class Step { Email, LinkSent }
    }

    private val _form = MutableStateFlow(FormState())
    val form: StateFlow<FormState> = _form.asStateFlow()

    fun onEmailChange(value: String) = _form.update { it.copy(email = value, error = null) }

    fun changeEmail() = _form.update { it.copy(step = FormState.Step.Email, error = null) }

    /** Sends the magic link; tapping it in the email completes sign-in via the deep link. */
    fun sendMagicLink() {
        val email = _form.value.email.trim()
        if (!email.contains("@") || !email.contains(".")) {
            _form.update { it.copy(error = "Enter a valid email") }
            return
        }
        _form.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            runCatching { authRepository.sendMagicLink(email) }
                .onSuccess { _form.update { it.copy(busy = false, step = FormState.Step.LinkSent) } }
                .onFailure { e ->
                    _form.update { it.copy(busy = false, error = e.message ?: "Couldn't send the link") }
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
