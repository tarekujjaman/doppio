package com.doppio.core.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Brand-locked schemes (no Material-You dynamic color, so Doppio looks the same on
// every device). Plum = primary, coral = secondary/accent, spark = tertiary.
private val LightColors = lightColorScheme(
    primary = Plum800,
    onPrimary = Color.White,
    primaryContainer = Plum100,
    onPrimaryContainer = Plum900,
    secondary = Coral500,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFFDE5DF),
    onSecondaryContainer = Color(0xFF7C3025),
    tertiary = Coral400,
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFFEF4F1),
    onTertiaryContainer = Color(0xFF973526),
    background = Slate50,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    surfaceVariant = Slate100,
    onSurfaceVariant = Slate500,
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color(0xFFFBFAFC),
    surfaceContainer = Slate50,
    surfaceContainerHigh = Slate100,
    surfaceContainerHighest = Slate200,
    outline = Slate300,
    outlineVariant = Slate200,
    error = Color(0xFFB3261E),
    onError = Color.White,
    errorContainer = Color(0xFFF9DEDC),
    onErrorContainer = Color(0xFF410E0B),
    inverseSurface = Ink,
    inverseOnSurface = Paper,
)

private val DarkColors = darkColorScheme(
    primary = Plum300,
    onPrimary = Ink,
    primaryContainer = Plum700,
    onPrimaryContainer = Plum100,
    secondary = Coral400,
    onSecondary = Ink,
    secondaryContainer = Color(0xFF7C3025),
    onSecondaryContainer = Color(0xFFFBCABE),
    tertiary = Spark,
    onTertiary = Ink,
    tertiaryContainer = Color(0xFF973526),
    onTertiaryContainer = Color(0xFFFDE5DF),
    background = Slate950,
    onBackground = Paper,
    surface = Slate900,
    onSurface = Paper,
    surfaceVariant = Slate800,
    onSurfaceVariant = Slate300,
    surfaceContainerLowest = Slate950,
    surfaceContainerLow = Color(0xFF211733),
    surfaceContainer = Slate900,
    surfaceContainerHigh = Slate800,
    surfaceContainerHighest = Slate700,
    outline = Slate700,
    outlineVariant = Slate800,
    error = Color(0xFFF2B8B5),
    onError = Color(0xFF601410),
    errorContainer = Color(0xFF8C1D18),
    onErrorContainer = Color(0xFFF9DEDC),
    inverseSurface = Paper,
    inverseOnSurface = Ink,
)

@Composable
fun DoppioTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = DoppioTypography,
        shapes = DoppioShapes,
        content = content,
    )
}