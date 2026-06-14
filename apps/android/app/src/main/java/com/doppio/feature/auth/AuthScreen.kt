package com.doppio.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
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
            DoppioMark(size = 72.dp)
            Spacer(Modifier.height(18.dp))
            DoppioWordmark(style = MaterialTheme.typography.displaySmall)
            Spacer(Modifier.height(8.dp))
            Text(
                "Your AI second brain for every conversation",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(36.dp))

            when {
                form.step == FormState.Step.LinkSent -> LinkSent(form, viewModel)
                form.mode == FormState.Mode.Password -> PasswordForm(form, viewModel)
                else -> MagicLinkForm(form, viewModel)
            }

            form.error?.let { Notice(it, isError = true) }
            form.notice?.let { Notice(it, isError = false) }
        }
    }
}

@Composable
private fun MagicLinkForm(form: FormState, vm: AuthViewModel) {
    EmailField(form.email, vm::onEmailChange, !form.busy, imeAction = ImeAction.Go, onGo = vm::sendMagicLink)
    Spacer(Modifier.height(16.dp))
    PrimaryButton("Send magic link", busy = form.busy, onClick = vm::sendMagicLink)
    Spacer(Modifier.height(8.dp))
    Text(
        "No password — we'll email you a secure sign-in link.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
    )
    TextButton(onClick = { vm.setMode(FormState.Mode.Password) }) { Text("Sign in with a password") }
}

@Composable
private fun PasswordForm(form: FormState, vm: AuthViewModel) {
    var show by remember { mutableStateOf(false) }
    EmailField(form.email, vm::onEmailChange, !form.busy, imeAction = ImeAction.Next)
    Spacer(Modifier.height(12.dp))
    OutlinedTextField(
        value = form.password,
        onValueChange = vm::onPasswordChange,
        label = { Text("Password") },
        singleLine = true,
        enabled = !form.busy,
        shape = MaterialTheme.shapes.medium,
        visualTransformation = if (show) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { vm.signInWithPassword() }),
        trailingIcon = {
            IconButton(onClick = { show = !show }) {
                Icon(
                    if (show) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                    contentDescription = if (show) "Hide password" else "Show password",
                )
            }
        },
        modifier = Modifier.fillMaxWidth(),
    )
    Spacer(Modifier.height(16.dp))
    PrimaryButton("Sign in", busy = form.busy, onClick = vm::signInWithPassword)
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        TextButton(onClick = vm::signUpWithPassword, enabled = !form.busy) { Text("Create account") }
        TextButton(onClick = vm::sendPasswordReset, enabled = !form.busy) { Text("Forgot password?") }
    }
    TextButton(onClick = { vm.setMode(FormState.Mode.MagicLink) }) { Text("Use a magic link instead") }
}

@Composable
private fun LinkSent(form: FormState, vm: AuthViewModel) {
    Icon(
        Icons.Default.MarkEmailRead,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.secondary,
        modifier = Modifier.size(40.dp),
    )
    Spacer(Modifier.height(12.dp))
    Text("Check your email", style = MaterialTheme.typography.headlineSmall)
    Text(
        "We sent a sign-in link to ${form.email}. Open it on this device and you'll be signed in automatically.",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 8.dp, bottom = 12.dp),
    )
    TextButton(onClick = vm::sendMagicLink, enabled = !form.busy) { Text("Resend link") }
    TextButton(onClick = vm::changeEmail) { Text("Use a different email") }
}

@Composable
private fun EmailField(
    value: String,
    onChange: (String) -> Unit,
    enabled: Boolean,
    imeAction: ImeAction,
    onGo: () -> Unit = {},
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text("Email address") },
        singleLine = true,
        enabled = enabled,
        shape = MaterialTheme.shapes.medium,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = imeAction),
        keyboardActions = KeyboardActions(onGo = { onGo() }),
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun PrimaryButton(label: String, busy: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = !busy,
        modifier = Modifier
            .fillMaxWidth()
            .height(54.dp),
    ) {
        if (busy) {
            CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(10.dp))
        }
        Text(label)
    }
}

@Composable
private fun Notice(text: String, isError: Boolean) {
    Text(
        text,
        style = MaterialTheme.typography.bodySmall,
        color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp),
    )
}
