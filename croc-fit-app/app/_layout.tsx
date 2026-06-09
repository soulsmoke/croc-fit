/**
 * Root layout — sets up navigation stack and auth guard.
 * Redirects unauthenticated users to the login screen.
 */

import { Stack, router } from 'expo-router';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '../contexts/AuthContext';

function RootNavigator(): React.JSX.Element {
    const { session, isLoading } = useAuth();

    useEffect(() => {
        if (isLoading) return;
        if (!session) {
            router.replace('/(auth)/login');
        }
    }, [session, isLoading]);

    return (
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(protected)" />
            <Stack.Screen
                name="workouts/[id]"
                options={{
                    headerShown: true,
                    title: 'Session',
                    animation: 'slide_from_right',
                }}
            />
        </Stack>
    );
}

export default function RootLayout(): React.JSX.Element {
    return (
        <AuthProvider>
            <RootNavigator />
        </AuthProvider>
    );
}
