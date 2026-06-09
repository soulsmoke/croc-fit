/**
 * Register screen — new account creation via Supabase Auth.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../contexts/AuthContext';

export default function RegisterScreen(): React.JSX.Element {
    const { signUp } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleRegister = async (): Promise<void> => {
        if (!email.trim() || !password.trim()) {
            setError('Inserisci email e password.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Le password non coincidono.');
            return;
        }
        if (password.length < 6) {
            setError('La password deve avere almeno 6 caratteri.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            await signUp(email.trim(), password);
            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registrazione fallita.');
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Registrazione completata</Text>
                <Text style={styles.successText}>
                    Controlla la tua email per confermare l'account, poi accedi.
                </Text>
                <Pressable
                    style={styles.button}
                    onPress={() => router.replace('/(auth)/login')}
                    accessibilityRole="button"
                    accessibilityLabel="Vai al login"
                >
                    <Text style={styles.buttonText}>Vai al login</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.container} accessibilityRole="none">
            <Text style={styles.title} accessibilityRole="header">
                Crea account
            </Text>
            <Text style={styles.subtitle}>Registrati a CrocFit Coach AI</Text>

            <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Indirizzo email"
                textContentType="emailAddress"
            />

            <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password (min. 6 caratteri)"
                secureTextEntry
                accessibilityLabel="Password"
                textContentType="newPassword"
            />

            <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Conferma password"
                secureTextEntry
                accessibilityLabel="Conferma password"
                textContentType="newPassword"
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
                onPress={handleRegister}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Registrati"
                accessibilityState={{ disabled: isLoading }}
            >
                {isLoading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Registrati</Text>
                )}
            </Pressable>

            <Pressable
                style={styles.linkContainer}
                onPress={() => router.replace('/(auth)/login')}
                accessibilityRole="button"
                accessibilityLabel="Hai già un account? Accedi"
            >
                <Text style={styles.linkText}>
                    Hai già un account?{' '}
                    <Text style={styles.link}>Accedi</Text>
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
    successText: {
        fontSize: 16,
        color: '#444',
        marginBottom: 32,
        lineHeight: 24,
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
