package com.doppio

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.doppio.core.capture.CaptureNotifications
import com.doppio.core.ui.theme.DoppioTheme
import dagger.hilt.android.AndroidEntryPoint
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.handleDeeplinks
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var supabase: SupabaseClient

    // One-shot navigation target from an intent (e.g. the recording notification).
    private var navTarget by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        // Cold start via the magic-link (doppio://auth-callback) → establish session.
        supabase.handleDeeplinks(intent)
        navTarget = intent?.getStringExtra(CaptureNotifications.EXTRA_NAVIGATE)
        setContent {
            DoppioTheme {
                RootScreen(navTarget = navTarget, onNavConsumed = { navTarget = null })
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // Warm start: app already running when the link / notification is tapped.
        supabase.handleDeeplinks(intent)
        navTarget = intent.getStringExtra(CaptureNotifications.EXTRA_NAVIGATE)
    }
}
