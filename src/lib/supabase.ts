import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local (see .env.example).",
  )
}

/**
 * Shared Supabase client (Postgres + Auth + Realtime).
 *
 * Uses the anon/public key only — every table read/write is gated by
 * Row-Level Security (defined in Stage 2). Never use a service-role key here.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
