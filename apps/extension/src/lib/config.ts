/** Build-time config (Vite inlines import.meta.env at build). */
export const APP_URL: string =
  (import.meta.env.VITE_APP_URL as string | undefined) ?? "https://doppio-gamma.vercel.app";
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
export const STORAGE_BUCKET = "doppio-audio";
