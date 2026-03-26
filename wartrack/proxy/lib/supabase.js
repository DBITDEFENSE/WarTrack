// ============================================
// SUPABASE — Server-side client (service role)
// ============================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rejsenubjifjuxuolvug.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

export const supabaseConfigured = !!SUPABASE_URL && SUPABASE_URL.includes('supabase.co') && !!SUPABASE_SERVICE_KEY;

let supabase = null;
if (supabaseConfigured) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  } catch (err) {
    console.warn('Supabase init failed:', err.message);
  }
}

export { supabase };
export { SUPABASE_URL };
