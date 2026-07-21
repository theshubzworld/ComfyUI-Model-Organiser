/**
 * src/lib/supabase.js
 * Frontend Supabase client — uses ANON key (safe to expose to browser).
 * For server-side API routes, use api/db.js with service_role key instead.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export const isAuthEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
