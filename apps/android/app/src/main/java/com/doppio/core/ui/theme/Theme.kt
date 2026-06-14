package com.doppio.core.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = Primary,
    primaryContainer = PrimaryContainer,
    onPrimaryContainer = OnPrimaryContainer,
    secondary = Accent,
    background = SurfaceLight,
    surface = SurfaceLight,
)

private val DarkColors = darkColorScheme(
    primary = PrimaryContainer,
    primaryContainer = PrimaryDark,
    onPrimaryContainer = PrimaryContainer,
    secondary = Accent,
    background = SurfaceDark,
    surface = SurfaceDark,
)

@Composable
fun DoppioTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = DoppioTypography,
        content = content,
    )
}
