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
        val mode: Mode = Mode.MagicLink,
        val email: String = "",
        val password: String = "",
        val busy: Boolean = false,
        val error: String? = null,
        val notice: String? = null,
    ) {
        enum class Step { Email, LinkSent }
        enum class Mode { MagicLink, Password }
    }

    private val _form = MutableStateFlow(FormState())
    val form: StateFlow<FormState> = _form.asStateFlow()

    fun onEmailChange(value: String) = _form.update { it.copy(email = value, error = null) }
    fun onPasswordChange(value: String) = _form.update { it.copy(password = value, error = null) }
    fun changeEmail() = _form.update { it.copy(step = FormState.Step.Email, error = null, notice = null) }

    fun setMode(mode: FormState.Mode) =
        _form.update { it.copy(mode = mode, error = null, notice = null, step = FormState.Step.Email) }

    private fun validEmail(email: String) = email.contains("@") && email.contains(".")

    /** Sends the magic link; tapping it in the email completes sign-in via the deep link. */
    fun sendMagicLink() {
        val email = _form.value.email.trim()
        if (!validEmail(email)) {
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

    /** Email + password sign-in. On success the gate flips to SignedIn automatically. */
    fun signInWithPassword() {
        val email = _form.value.email.trim()
        val pw = _form.value.password
        if (!validEmail(email)) { _form.update { it.copy(error = "Enter a valid email") }; return }
        if (pw.isEmpty()) { _form.update { it.copy(error = "Enter your password") }; return }
        _form.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            runCatching { authRepository.signInWithPassword(email, pw) }
                .onSuccess { _form.update { it.copy(busy = false) } }
                .onFailure { e ->
                    _form.update { it.copy(busy = false, error = friendlyAuthError(e.message)) }
                }
        }
    }

    /** Create an account with a password. */
    fun signUpWithPassword() {
        val email = _form.value.email.trim()
        val pw = _form.value.password
        if (!validEmail(email)) { _form.update { it.copy(error = "Enter a valid email") }; return }
        if (pw.length < 6) { _form.update { it.copy(error = "Password must be at least 6 characters") }; return }
        _form.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            runCatching { authRepository.signUpWithPassword(email, pw) }
                .onSuccess {
                    _form.update {
                        it.copy(busy = false, notice = "Account created. If asked, confirm via the email we sent, then sign in.")
                    }
                }
                .onFailure { e ->
                    _form.update { it.copy(busy = false, error = friendlyAuthError(e.message)) }
                }
        }
    }

    /** Sends a password-reset email. */
    fun sendPasswordReset() {
        val email = _form.value.email.trim()
        if (!validEmail(email)) { _form.update { it.copy(error = "Enter your email first") }; return }
        _form.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            runCatching { authRepository.sendPasswordReset(email) }
                .onSuccess {
                    _form.update { it.copy(busy = false, notice = "Reset link sent to $email. Open it on this device.") }
                }
                .onFailure { e ->
                    _form.update { it.copy(busy = false, error = e.message ?: "Couldn't send reset link") }
                }
        }
    }

    private fun friendlyAuthError(raw: String?): String = when {
        raw == null -> "Something went wrong"
        raw.contains("Invalid login", ignoreCase = true) ||
            raw.contains("credentials", ignoreCase = true) -> "Wrong email or password"
        raw.contains("already", ignoreCase = true) -> "That email already has an account — sign in or reset your password"
        else -> raw
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
