/**
 * Root layout — sets up navigation stack and auth guard.
 * Redirects unauthenticated users to the login screen.
 */

import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

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
    // Inject apple-touch-icon meta tags for PWA "Add to Home Screen" on iOS Safari
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (typeof document === 'undefined') return;

        const link = document.createElement('link');
        link.rel = 'apple-touch-icon';
        link.href = '/assets/apple-touch-icon.png';
        document.head.appendChild(link);

        return () => {
            document.head.removeChild(link);
        };
    }, []);

    return (
        <AuthProvider>
            <RootNavigator />
        </AuthProvider>
    );
}
