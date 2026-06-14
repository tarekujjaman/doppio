package com.doppio

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.doppio.feature.library.LibraryScreen
import com.doppio.feature.workspace.WorkspaceScreen
import com.doppio.feature.workspace.WorkspaceViewModel

object Routes {
    const val LIBRARY = "library"
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
                onSignOut = onSignOut,
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
