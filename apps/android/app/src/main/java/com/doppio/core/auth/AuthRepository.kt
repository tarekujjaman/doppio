package com.doppio.core.auth

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.providers.builtin.OTP
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

/** Thin wrapper over supabase-kt Auth so the UI never depends on supabase types directly. */
@Singleton
class AuthRepository @Inject constructor(
    private val supabase: SupabaseClient,
) {
    val sessionStatus: StateFlow<SessionStatus> get() = supabase.auth.sessionStatus

    /**
     * Sends a magic-link email. The link redirects to the configured deep link
     * (doppio://auth-callback); tapping it opens the app and establishes the
     * session via SupabaseClient.handleDeeplinks(). Works for any user on the
     * Supabase free tier (no custom SMTP / template edits needed).
     */
    suspend fun sendMagicLink(email: String) {
        supabase.auth.signInWith(OTP) { this.email = email.trim() }
    }

    /** Email + password sign-in (for users who have set a password). */
    suspend fun signInWithPassword(email: String, password: String) {
        supabase.auth.signInWith(Email) {
            this.email = email.trim()
            this.password = password
        }
    }

    /** Create an account with a password. Subject to the project's email-confirmation
     *  setting (may require confirming via email before the session is active). */
    suspend fun signUpWithPassword(email: String, password: String) {
        supabase.auth.signUpWith(Email) {
            this.email = email.trim()
            this.password = password
        }
    }

    /** Sends a password-reset email; the link opens the app via the deep link. */
    suspend fun sendPasswordReset(email: String) {
        supabase.auth.resetPasswordForEmail(email.trim(), redirectUrl = "doppio://auth-callback")
    }

    /** Sets/changes the signed-in user's password (used from Settings). */
    suspend fun updatePassword(newPassword: String) {
        supabase.auth.updateUser { password = newPassword }
    }

    suspend fun signOut() {
        supabase.auth.signOut()
    }
}
