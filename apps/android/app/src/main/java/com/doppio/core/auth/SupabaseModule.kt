package com.doppio.core.auth

import com.doppio.BuildConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object SupabaseModule {

    /**
     * supabase-kt owns identity. The default Android session manager persists the
     * session (auto-refresh on), so a cold start with a saved session restores auth.
     * Only Auth is installed in A1; Storage is added in A4 (capture).
     */
    @Provides
    @Singleton
    fun provideSupabaseClient(): SupabaseClient = createSupabaseClient(
        supabaseUrl = BuildConfig.SUPABASE_URL,
        supabaseKey = BuildConfig.SUPABASE_ANON_KEY,
    ) {
        install(Auth) {
            // Magic-link deep link: the email link redirects to doppio://auth-callback,
            // which MainActivity hands to handleDeeplinks() to establish the session.
            scheme = "doppio"
            host = "auth-callback"
        }
    }
}
