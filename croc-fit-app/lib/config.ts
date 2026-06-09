/**
 * App-wide configuration loaded from app.config.json and EXPO_PUBLIC_* overrides.
 * Validated with Zod at startup — fails fast if required config is missing.
 */

import { z } from 'zod';

import rawConfig from '../app.config.json';

const ConfigSchema = z.object({
    apiUrl: z.string().url('EXPO_PUBLIC_API_URL must be a valid URL'),
    supabaseUrl: z.string().url('EXPO_PUBLIC_SUPABASE_URL must be a valid URL'),
    supabaseAnonKey: z.string().min(1, 'EXPO_PUBLIC_SUPABASE_ANON_KEY is required'),
    authMode: z.enum(['none', 'supabase']).default('supabase'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

const merged = {
    ...rawConfig,
    ...(process.env['EXPO_PUBLIC_API_URL'] && { apiUrl: process.env['EXPO_PUBLIC_API_URL'] }),
    ...(process.env['EXPO_PUBLIC_SUPABASE_URL'] && { supabaseUrl: process.env['EXPO_PUBLIC_SUPABASE_URL'] }),
    ...(process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] && { supabaseAnonKey: process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] }),
};

const parsed = ConfigSchema.safeParse(merged);

if (!parsed.success) {
    throw new Error(`[CrocFit] Invalid app config:\n${parsed.error.message}`);
}

export const config: AppConfig = parsed.data;
