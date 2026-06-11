import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const AUDIO_BUCKET = "doppio-audio";

/** Server-only admin client (service role) for Storage operations. */
function adminStorage() {
  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  return client.storage.from(AUDIO_BUCKET);
}

/** One-time signed PUT target; the client uploads with uploadToSignedUrl(path, token, file). */
export async function createSignedUpload(path: string) {
  const { data, error } = await adminStorage().createSignedUploadUrl(path);
  if (error) throw new Error(`createSignedUploadUrl failed: ${error.message}`);
  return { path: data.path, token: data.token };
}

export async function downloadAudio(path: string): Promise<Uint8Array> {
  const { data, error } = await adminStorage().download(path);
  if (error) throw new Error(`storage download failed: ${error.message}`);
  return new Uint8Array(await data.arrayBuffer());
}

export async function deleteAudio(path: string): Promise<void> {
  await adminStorage().remove([path]);
}

/** Short-lived playback URL (≤10 min per security bar). */
export async function createSignedPlaybackUrl(path: string, expiresInSec = 600) {
  const { data, error } = await adminStorage().createSignedUrl(path, expiresInSec);
  if (error) throw new Error(`createSignedUrl failed: ${error.message}`);
  return data.signedUrl;
}
