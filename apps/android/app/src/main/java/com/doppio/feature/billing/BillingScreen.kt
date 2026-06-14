package com.doppio.feature.billing

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.doppio.BuildConfig
import com.doppio.core.network.dto.UsageDto

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BillingScreen(
    onBack: () -> Unit,
    viewModel: BillingViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val context = LocalContext.current

    androidx.compose.runtime.LaunchedEffect(ui.checkoutUrl) {
        ui.checkoutUrl?.let { url ->
            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri())) }
            viewModel.checkoutOpened()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Plan & usage") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { inner ->
        when {
            ui.loading -> Box(Modifier.fillMaxSize().padding(inner), Alignment.Center) { CircularProgressIndicator() }
            ui.billing == null -> Box(Modifier.fillMaxSize().padding(inner), Alignment.Center) {
                Text(ui.message ?: "Couldn't load billing")
            }
            else -> {
                val b = ui.billing!!
                Column(
                    Modifier
                        .padding(inner)
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Text(
                        "Current plan: ${b.plan}",
                        style = MaterialTheme.typography.titleLarge,
                    )
                    b.planExpiresAt?.let {
                        Text("Active until ${it.take(10)}", style = MaterialTheme.typography.bodySmall)
                    }

                    UsageCard(b.usage)

                    if (b.plan == "FREE") {
                        if (BuildConfig.ENABLE_IN_APP_PURCHASE) {
                            Button(
                                onClick = viewModel::upgrade,
                                enabled = !ui.busy,
                                modifier = Modifier.fillMaxWidth(),
                            ) { Text("Upgrade to Pro") }
                        } else {
                            Text(
                                "Pro upgrades are managed on the Doppio website.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    } else {
                        OutlinedButton(
                            onClick = viewModel::cancel,
                            enabled = !ui.busy,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("Cancel Pro (stays active until period ends)") }
                    }

                    ui.message?.let {
                        Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }

                    if (b.payments.isNotEmpty()) {
                        Text("Payments", style = MaterialTheme.typography.titleSmall)
                        b.payments.forEach { p ->
                            Text(
                                "${p.createdAt.take(10)} · ${p.amountBdt} BDT · ${p.status}",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun UsageCard(usage: UsageDto) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Meter(
                "Transcription this month",
                usage.transcribeMinutesThisMonth,
                usage.transcribeMinutesCap,
                "min",
            )
            Meter("Ask calls today", usage.askCallsToday, usage.askCallsCap, "")
        }
    }
}

@Composable
private fun Meter(label: String, used: Int, cap: Int, unit: String) {
    val pct = if (cap > 0) (used.toFloat() / cap).coerceIn(0f, 1f) else 0f
    Column {
        Text(
            "$label: $used / $cap ${unit}".trim(),
            style = MaterialTheme.typography.bodyMedium,
        )
        LinearProgressIndicator(
            progress = { pct },
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp),
        )
    }
}
