/**
 * Login screen — email/password authentication via Supabase.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen(): React.JSX.Element {
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (): Promise<void> => {
        if (!email.trim() || !password.trim()) {
            setError('Enter email and password.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            await signIn(email.trim(), password);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container} accessibilityRole="none">
            <Text style={styles.title} accessibilityRole="header">
                CrocFit Coach AI
            </Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>

            <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Email address"
                accessibilityHint="Enter your email address"
                textContentType="emailAddress"
            />

            <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                secureTextEntry
                accessibilityLabel="Password"
                accessibilityHint="Enter your password"
                textContentType="password"
            />

            {error ? (
                <Text
                    style={styles.error}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                >
                    {error}
                </Text>
            ) : null}

            <Pressable
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                accessibilityState={{ disabled: isLoading }}
            >
                {isLoading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Sign In</Text>
                )}
            </Pressable>

            <Pressable
                style={styles.linkContainer}
                onPress={() => router.replace('/(auth)/register')}
                accessibilityRole="button"
                accessibilityLabel="Non hai un account? Registrati"
            >
                <Text style={styles.linkText}>
                    Non hai un account?{' '}
                    <Text style={styles.link}>Registrati</Text>
                </Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 8,
        color: '#1a1a1a',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 32,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        marginBottom: 16,
        backgroundColor: '#fafafa',
    },
    error: {
        color: '#d00',
        marginBottom: 16,
        fontSize: 14,
    },
    button: {
        backgroundColor: '#007AFF',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    linkContainer: {
        marginTop: 24,
        alignItems: 'center',
    },
    linkText: {
        fontSize: 15,
        color: '#666',
    },
    link: {
        color: '#007AFF',
        fontWeight: '600',
    },
});
