/**
 * AuthContext — Supabase session management for CrocFit app.
 *
 * Provides session, user, login (via Supabase), and logout.
 * Uses Supabase onAuthStateChange to stay in sync with the session.
 */

import { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

interface AuthContextValue {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provides Supabase auth state to the component tree.
 */
export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
            setSession(s);
            setIsLoading(false);
        });

        const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
            setSession(s);
        });

        return () => listener.subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string): Promise<void> => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/(protected)');
    };

    const signUp = async (email: string, password: string): Promise<void> => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
    };

    const signOut = async (): Promise<void> => {
        await supabase.auth.signOut();
        router.replace('/(auth)/login');
    };

    return (
        <AuthContext.Provider
            value={{
                session,
                user: session?.user ?? null,
                isLoading,
                signIn,
                signUp,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Hook to access the auth context. Must be used inside AuthProvider.
 *
 * @throws Error if used outside of AuthProvider.
 */
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
