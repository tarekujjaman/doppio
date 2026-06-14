package com.doppio.core.auth

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Bridges supabase-kt's session to OkHttp. `currentToken()` is read on every request
 * by [AuthInterceptor]; `refreshBlocking()` is called by [TokenAuthenticator] on a 401
 * (OkHttp invokes authenticators on a background thread, so blocking here is safe).
 */
@Singleton
class TokenProvider @Inject constructor(
    private val supabase: SupabaseClient,
) {
    fun currentToken(): String? = supabase.auth.currentAccessTokenOrNull()

    fun refreshBlocking(): String? = runBlocking {
        runCatching {
            supabase.auth.refreshCurrentSession()
            supabase.auth.currentAccessTokenOrNull()
        }.getOrNull()
    }
}
