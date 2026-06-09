import { useEffect, useRef, useState } from 'react';

import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

/** Visual state of the voice button. */
type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

interface VoiceInputButtonProps {
    /**
     * Called with the final transcript when recognition ends successfully.
     * The parent should place the text in the input field.
     */
    onTranscript: (text: string) => void;
    /** Whether the parent component is currently loading (disables the button). */
    disabled?: boolean;
}

/**
 * Tap-to-dictate microphone button for CrocFit coach chat.
 * Uses expo-speech-recognition (on-device STT, Italian) — no cloud, no cost.
 *
 * Tap once → starts listening (mic icon animates).
 * Tap again → stops → transcript appears in the text input.
 *
 * Lifecycle:
 *   tap → start() → "start" event → "result" (interim) → ... → tap →
 *   stop() → "result" (isFinal=true) → "audioend" → "end" → onTranscript()
 */
export default function VoiceInputButton({ onTranscript, disabled = false }: VoiceInputButtonProps) {
    const [voiceState, setVoiceState] = useState<VoiceState>('idle');
    const [liveText, setLiveText] = useState('');
    const finalTranscriptRef = useRef('');
    const isListening = voiceState === 'listening';

    useSpeechRecognitionEvent('start', () => {
        setVoiceState('listening');
    });

    useSpeechRecognitionEvent('result', (event) => {
        const text = event.results[0]?.transcript ?? '';
        setLiveText(text);
        if (event.isFinal) {
            finalTranscriptRef.current = text;
        }
    });

    // Reset processing state when parent finishes sending (disabled: true → false).
    useEffect(() => {
        if (!disabled && voiceState === 'processing') {
            setVoiceState('idle');
        }
    }, [disabled, voiceState]);

    useSpeechRecognitionEvent('end', () => {
        const text = finalTranscriptRef.current.trim();
        setLiveText('');
        finalTranscriptRef.current = '';
        if (text) {
            setVoiceState('processing');
            onTranscript(text);
        } else {
            setVoiceState('idle');
        }
    });

    useSpeechRecognitionEvent('error', (event) => {
        // "aborted" and "no-speech" are expected — no visual error.
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
            setVoiceState('error');
            const msg = event.message ? `${event.error}: ${event.message}` : event.error;
            setLiveText(msg);
            setTimeout(() => {
                setVoiceState('idle');
                setLiveText('');
            }, 4000);
        } else {
            setVoiceState('idle');
        }
    });

    const handlePress = async (): Promise<void> => {
        if (isListening) {
            ExpoSpeechRecognitionModule.stop();
            return;
        }

        if (disabled || voiceState === 'processing') return;

        const permResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!permResult.granted) {
            setVoiceState('error');
            setLiveText('Permesso microfono negato. Abilitalo in Impostazioni.');
            setTimeout(() => {
                setVoiceState('idle');
                setLiveText('');
            }, 5000);
            return;
        }

        setLiveText('');
        finalTranscriptRef.current = '';
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        ExpoSpeechRecognitionModule.start({
            lang: 'it-IT',
            interimResults: true,
            continuous: false,
            addsPunctuation: true,
            contextualStrings: [
                'allenamento', 'workout', 'serie', 'ripetizioni', 'peso',
                'cardio', 'recupero', 'PR', 'bench press', 'squat', 'stacco',
                'calorie', 'proteine', 'carboidrati', 'grassi', 'pasto',
            ],
            iosTaskHint: 'dictation',
            iosCategory: {
                category: 'playAndRecord',
                categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
                mode: 'measurement',
            },
        });
    };

    const isDisabled = disabled || voiceState === 'processing';

    return (
        <View style={styles.container}>
            <Pressable
                onPress={handlePress}
                disabled={isDisabled}
                style={[
                    styles.button,
                    isListening && styles.buttonListening,
                    isDisabled && styles.buttonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={isListening ? 'Interrompi dettatura' : 'Detta il messaggio'}
                accessibilityState={{ disabled: isDisabled }}
            >
                {voiceState === 'processing' ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                ) : isListening ? (
                    // Square = stop icon while recording
                    <View style={styles.stopIcon} />
                ) : (
                    <Ionicons
                        name="mic-outline"
                        size={22}
                        color={isDisabled ? '#ccc' : '#555'}
                        aria-hidden
                    />
                )}
            </Pressable>

            {/* Live transcript bubble */}
            {(isListening && liveText) ? (
                <View style={styles.bubble} pointerEvents="none">
                    <Text style={styles.bubbleText} numberOfLines={3}>
                        {liveText}
                    </Text>
                </View>
            ) : null}

            {/* Error bubble */}
            {voiceState === 'error' && liveText ? (
                <View style={[styles.bubble, styles.bubbleError]} pointerEvents="none">
                    <Text style={styles.bubbleErrorText} numberOfLines={3}>
                        {liveText}
                    </Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    button: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    buttonListening: {
        backgroundColor: '#FF3B3015',
    },
    buttonDisabled: {
        opacity: 0.4,
    },
    stopIcon: {
        width: 14,
        height: 14,
        borderRadius: 2,
        backgroundColor: '#FF3B30',
    },
    bubble: {
        position: 'absolute',
        bottom: 48,
        left: '50%',
        transform: [{ translateX: -120 }],
        width: 240,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 122, 255, 0.3)',
    },
    bubbleText: {
        color: '#e0e0e0',
        fontSize: 13,
        lineHeight: 18,
    },
    bubbleError: {
        borderColor: 'rgba(255, 59, 48, 0.4)',
    },
    bubbleErrorText: {
        color: '#FF6B6B',
        fontSize: 13,
        lineHeight: 18,
    },
});
