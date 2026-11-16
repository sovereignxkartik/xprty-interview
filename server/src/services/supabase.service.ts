import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseKey && 
  !supabaseUrl.includes('independent-project.supabase.co') &&
  !supabaseUrl.includes('placeholder')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Password authentication always uses the publishable/anon key. The service
// role client remains server-only and is used solely for database writes.
export const supabaseAuth: SupabaseClient | null = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

if (isSupabaseConfigured) {
  console.log(`[Supabase] Connected to live PostgreSQL instance: ${supabaseUrl}`);
} else {
  console.log(`[Database] Live Supabase credentials not set in .env. Running robust local storage adapter with full PostgreSQL schema mapping.`);
}
