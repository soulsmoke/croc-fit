/**
 * Supabase client singleton for CrocFit app.
 * Uses anon key for auth and read operations.
 */

import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { config } from './config';

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
