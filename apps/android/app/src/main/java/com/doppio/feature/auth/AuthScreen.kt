package com.doppio.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MarkEmailRead
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.doppio.core.ui.DoppioMark
import com.doppio.core.ui.DoppioWordmark
import com.doppio.feature.auth.AuthViewModel.FormState

@Composable
fun AuthScreen(viewModel: AuthViewModel) {
    val form by viewModel.form.collectAsStateWithLifecycle()

    Scaffold { inner ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(inner)
                .padding(horizontal = 28.dp)
                .widthIn(max = 460.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            DoppioMark(size = 76.dp)
            Spacer(Modifier.height(20.dp))
            DoppioWordmark(style = MaterialTheme.typography.displaySmall)
            Spacer(Modifier.height(10.dp))
            Text(
                "Your AI second brain for every conversation",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(40.dp))

            when (form.step) {
                FormState.Step.Email -> {
                    OutlinedTextField(
                        value = form.email,
                        onValueChange = viewModel::onEmailChange,
                        label = { Text("Email address") },
                        singleLine = true,
                        enabled = !form.busy,
                        shape = MaterialTheme.shapes.medium,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Go,
                        ),
                        keyboardActions = KeyboardActions(onGo = { viewModel.sendMagicLink() }),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    form.error?.let {
                        Text(
                            it,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 8.dp, start = 4.dp),
                        )
                    }
                    Button(
                        onClick = viewModel::sendMagicLink,
                        enabled = !form.busy,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp)
                            .padding(top = 0.dp),
                    ) {
                        if (form.busy) {
                            CircularProgressIndicator(
                                strokeWidth = 2.dp,
                                modifier = Modifier
                                    .size(18.dp)
                                    .padding(end = 0.dp),
                            )
                            Spacer(Modifier.size(10.dp))
                        }
                        Text("Send magic link")
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "No password — we'll email you a secure sign-in link.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                }

                FormState.Step.LinkSent -> {
                    Icon(
                        Icons.Default.MarkEmailRead,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.secondary,
                        modifier = Modifier.size(40.dp),
                    )
                    Spacer(Modifier.height(12.dp))
                    Text("Check your email", style = MaterialTheme.typography.headlineSmall)
                    Text(
                        "We sent a sign-in link to ${form.email}. Open it on this device and " +
                            "you'll be signed in automatically.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 8.dp, bottom = 12.dp),
                    )
                    TextButton(onClick = viewModel::sendMagicLink, enabled = !form.busy) {
                        Text("Resend link")
                    }
                    TextButton(onClick = viewModel::changeEmail) {
                        Text("Use a different email")
                    }
                }
            }
        }
    }
}