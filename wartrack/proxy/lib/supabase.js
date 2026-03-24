// ============================================
// SUPABASE — Server-side client (service role)
// ============================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

export const supabaseConfigured = !!SUPABASE_URL && SUPABASE_URL.includes('supabase.co');

let supabase = null;
if (supabaseConfigured) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export { supabase };
export { SUPABASE_URL };
