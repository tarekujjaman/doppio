package com.doppio.core.auth

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.OtpType
import io.github.jan.supabase.auth.auth
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

    /** Emails a 6-digit OTP (project email template must be set to "token"/OTP). */
    suspend fun sendEmailOtp(email: String) {
        supabase.auth.signInWith(OTP) { this.email = email.trim() }
    }

    /** Verifies the OTP code; on success supabase flips sessionStatus to Authenticated. */
    suspend fun verifyEmailOtp(email: String, code: String) {
        supabase.auth.verifyEmailOtp(
            type = OtpType.Email.EMAIL,
            email = email.trim(),
            token = code.trim(),
        )
    }

    suspend fun signOut() {
        supabase.auth.signOut()
    }
}
