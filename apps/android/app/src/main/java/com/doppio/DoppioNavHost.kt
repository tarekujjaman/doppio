package com.doppio

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.doppio.feature.billing.BillingScreen
import com.doppio.feature.capture.CaptureScreen
import com.doppio.feature.library.LibraryScreen
import com.doppio.feature.search.SearchScreen
import com.doppio.feature.settings.SettingsScreen
import com.doppio.feature.workspace.WorkspaceScreen
import com.doppio.feature.workspace.WorkspaceViewModel

object Routes {
    const val LIBRARY = "library"
    const val CAPTURE = "capture"
    const val SEARCH = "search"
    const val BILLING = "billing"
    const val SETTINGS = "settings"
    const val SESSION = "session/{${WorkspaceViewModel.ARG_ID}}"
    fun session(id: String) = "session/$id"
}

@Composable
fun DoppioNavHost(onSignOut: () -> Unit) {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = Routes.LIBRARY) {
        composable(Routes.LIBRARY) {
            LibraryScreen(
                onOpenSession = { id -> nav.navigate(Routes.session(id)) },
                onNewSession = { nav.navigate(Routes.CAPTURE) },
                onSearch = { nav.navigate(Routes.SEARCH) },
                onBilling = { nav.navigate(Routes.BILLING) },
                onSettings = { nav.navigate(Routes.SETTINGS) },
                onSignOut = onSignOut,
            )
        }
        composable(Routes.BILLING) { BillingScreen(onBack = { nav.popBackStack() }) }
        composable(Routes.SETTINGS) { SettingsScreen(onBack = { nav.popBackStack() }) }
        composable(Routes.SEARCH) {
            SearchScreen(
                onOpenSession = { id -> nav.navigate(Routes.session(id)) },
                onBack = { nav.popBackStack() },
            )
        }
        composable(Routes.CAPTURE) {
            CaptureScreen(
                onDone = { nav.popBackStack() },
                onBack = { nav.popBackStack() },
            )
        }
        composable(
            route = Routes.SESSION,
            arguments = listOf(navArgument(WorkspaceViewModel.ARG_ID) { type = NavType.StringType }),
        ) {
            WorkspaceScreen(onBack = { nav.popBackStack() })
        }
    }
}
