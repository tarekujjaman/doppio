package com.doppio

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.doppio.feature.auth.AuthGate
import com.doppio.feature.auth.AuthScreen
import com.doppio.feature.auth.AuthViewModel

/** Auth gate: a restored session lands straight in the app; otherwise the OTP flow. */
@Composable
fun RootScreen(navTarget: String? = null, onNavConsumed: () -> Unit = {}) {
    val authViewModel: AuthViewModel = hiltViewModel()
    val gate by authViewModel.gate.collectAsStateWithLifecycle()

    when (gate) {
        AuthGate.Loading -> Box(Modifier.fillMaxSize(), Alignment.Center) {
            CircularProgressIndicator()
        }
        AuthGate.SignedOut -> AuthScreen(authViewModel)
        AuthGate.SignedIn -> DoppioNavHost(
            onSignOut = authViewModel::signOut,
            navTarget = navTarget,
            onNavConsumed = onNavConsumed,
        )
    }
}
