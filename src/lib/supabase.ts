import { createClient } from '@supabase/supabase-js';

// Prioritize environment variables for server-side usage
// SUPABASE_SERVICE_ROLE_KEY is preferred for backend operations (bypassing RLS)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and Key must be defined in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
