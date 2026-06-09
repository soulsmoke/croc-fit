/**
 * Coach chat screen — SSE streaming chat with the CrocFit AI coach.
 * Main entry point for REQ-001, REQ-002, REQ-003, REQ-004.
 */

import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

const coachAvatar = require('../../assets/coach-avatar.png') as number;

import VoiceInputButton from '../../components/VoiceInputButton';
import {
    ActivityIndicator,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { useAuth } from '../../contexts/AuthContext';
import { AttachmentRecord, streamChat, uploadAttachment } from '../../lib/api';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    attachmentUri?: string;
    isStreaming?: boolean;
}

interface PendingAttachment {
    uri: string;
    filename: string;
    mimeType: string;
}

const THREAD_ID = 'default';

const QUICK_PROMPTS = [
    'Pianifica la mia settimana',
    'Calcola i carichi di oggi',
    'Analizza la mia dieta di ieri',
];

export default function CoachScreen(): React.JSX.Element {
    const { session } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const listRef = useRef<FlatList<Message>>(null);

    const userId = session?.user?.id ?? 'anonymous';
    const accessToken = session?.access_token;

    const handleAttachment = async (): Promise<void> => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: false,
            quality: 0.8,
        });

        if (result.canceled || result.assets.length === 0) return;

        const asset = result.assets[0];
        const filename = asset.fileName ?? `photo_${Date.now()}.jpg`;
        const mimeType = asset.mimeType ?? 'image/jpeg';

        setPendingAttachment({ uri: asset.uri, filename, mimeType });
    };

    const sendMessage = async (text: string): Promise<void> => {
        const trimmed = text.trim();
        if ((!trimmed && !pendingAttachment) || isSending) return;

        let uploadedRecord: AttachmentRecord | null = null;

        if (pendingAttachment && accessToken) {
            setIsUploading(true);
            try {
                uploadedRecord = await uploadAttachment(
                    pendingAttachment.uri,
                    pendingAttachment.filename,
                    pendingAttachment.mimeType,
                    userId,
                    accessToken,
                );
            } catch (uploadErr) {
                // Show the error in chat rather than silently dropping the attachment
                const errMsg = uploadErr instanceof Error ? uploadErr.message : 'Upload fallito';
                const errId = Date.now().toString();
                setMessages((prev) => [
                    ...prev,
                    { id: errId, role: 'assistant', content: `⚠️ Impossibile caricare l'immagine: ${errMsg}` },
                ]);
            } finally {
                setIsUploading(false);
            }
        }

        // Build message text: user text + attachment context for the agent
        const attachmentNote = uploadedRecord
            ? `\n[Screenshot allegato: ${uploadedRecord.filename}${uploadedRecord.public_url ? ` — ${uploadedRecord.public_url}` : ''}]`
            : '';
        const messageText = (trimmed + attachmentNote).trim();
        if (!messageText) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText,
            attachmentUri: pendingAttachment?.uri,
        };
        const assistantMsgId = (Date.now() + 1).toString();
        const assistantMsg: Message = {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            isStreaming: true,
        };

        setMessages((prev) => [...prev, userMsg, assistantMsg]);
        setInput('');
        setPendingAttachment(null);
        setIsSending(true);

        abortRef.current = new AbortController();

        try {
            await streamChat(
                {
                    thread_id: THREAD_ID,
                    message: messageText,
                    user_id: userId,
                    history: messages
                        .filter((m) => !m.isStreaming)
                        .map((m) => ({ role: m.role, content: m.content })),
                },
                (accumulated) => {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMsgId
                                ? { ...m, content: accumulated, isStreaming: true }
                                : m,
                        ),
                    );
                    listRef.current?.scrollToEnd({ animated: true });
                },
                accessToken,
                abortRef.current.signal,
            );
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantMsgId
                            ? { ...m, content: 'Error connecting to coach. Try again.', isStreaming: false }
                            : m,
                    ),
                );
            }
        } finally {
            setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m)),
            );
            setIsSending(false);
            abortRef.current = null;
        }
    };

    const renderMessage = ({ item }: { item: Message }): React.JSX.Element => {
        if (item.role === 'user') {
            return (
                <View
                    style={[styles.bubble, styles.userBubble]}
                    accessibilityRole="text"
                    accessibilityLabel={`You: ${item.content}`}
                >
                    {item.attachmentUri ? (
                        <Image
                            source={{ uri: item.attachmentUri }}
                            style={styles.attachmentThumbnail}
                            accessibilityLabel="Immagine allegata"
                            resizeMode="cover"
                        />
                    ) : null}
                    {item.content ? (
                        <Text style={styles.userText}>
                            {item.content}
                        </Text>
                    ) : null}
                </View>
            );
        }
        return (
            <View style={styles.aiMessageRow} accessibilityRole="text" accessibilityLabel={`Coach: ${item.content}`}>
                <Image
                    source={coachAvatar}
                    style={styles.coachAvatarSmall}
                    accessibilityLabel="Coach avatar"
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                />
                <View style={[styles.bubble, styles.aiBubble]}>
                    {item.content ? (
                        <Text style={styles.aiText}>
                            {item.content}
                            {item.isStreaming ? ' ▌' : ''}
                        </Text>
                    ) : null}
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={90}
        >
            {messages.length === 0 ? (
                <View style={styles.emptyState}>
                    <Image
                        source={coachAvatar}
                        style={styles.emptyAvatar}
                        accessibilityLabel="CrocFit Coach"
                        resizeMode="contain"
                    />
                    <Text style={styles.emptyTitle} accessibilityRole="header">
                        CrocFit Coach AI
                    </Text>
                    <Text style={styles.emptySubtitle}>Chiedi al tuo coach tutto su allenamento, nutrizione e recupero.</Text>
                    <View style={styles.quickPrompts} accessibilityRole="none">
                        {QUICK_PROMPTS.map((p) => (
                            <Pressable
                                key={p}
                                style={styles.chip}
                                onPress={() => sendMessage(p)}
                                accessibilityRole="button"
                                accessibilityLabel={`Quick prompt: ${p}`}
                            >
                                <Text style={styles.chipText}>{p}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            ) : (
                <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={(m) => m.id}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.messageList}
                    onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                    accessibilityRole="list"
                    accessibilityLabel="Chat messages"
                />
            )}

            {pendingAttachment ? (
                <View style={styles.attachmentPreviewRow} accessibilityRole="none">
                    <Image
                        source={{ uri: pendingAttachment.uri }}
                        style={styles.attachmentPreview}
                        accessibilityLabel="Selected attachment preview"
                        resizeMode="cover"
                    />
                    <Pressable
                        style={styles.attachmentRemove}
                        onPress={() => setPendingAttachment(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Remove attachment"
                    >
                        <Text style={styles.attachmentRemoveIcon}>✕</Text>
                    </Pressable>
                    {isUploading ? <ActivityIndicator size="small" color="#007AFF" style={{ marginLeft: 8 }} /> : null}
                </View>
            ) : null}

            <View style={styles.inputRow}>
                <Pressable
                    style={styles.attachButton}
                    onPress={handleAttachment}
                    disabled={isSending}
                    accessibilityRole="button"
                    accessibilityLabel="Attach image"
                    accessibilityState={{ disabled: isSending }}
                >
                    <Ionicons name="image-outline" size={22} color={isSending ? '#ccc' : '#555'} aria-hidden />
                </Pressable>
                <VoiceInputButton
                    onTranscript={(text) => setInput((prev) => (prev ? prev + ' ' + text : text))}
                    disabled={isSending}
                />
                <TextInput
                    style={styles.textInput}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Message your coach…"
                    multiline
                    accessibilityLabel="Chat message input"
                    accessibilityHint="Type a message and press Send"
                    returnKeyType="send"
                    onSubmitEditing={() => sendMessage(input)}
                    blurOnSubmit={false}
                    editable={!isSending}
                />
                <Pressable
                    style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
                    onPress={() => sendMessage(input)}
                    disabled={isSending}
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
                    accessibilityState={{ disabled: isSending }}
                >
                    {isSending ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.sendIcon}>↑</Text>
                    )}
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    messageList: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
    aiMessageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginVertical: 2,
    },
    coachAvatarSmall: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f0f0f0',
    },
    emptyAvatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        marginBottom: 20,
        backgroundColor: '#f0f0f0',
    },
    bubble: {
        maxWidth: '80%',
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginVertical: 2,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#007AFF',
    },
    aiBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#f0f0f0',
    },
    userText: { color: '#fff', fontSize: 16, lineHeight: 22 },
    aiText: { color: '#1a1a1a', fontSize: 16, lineHeight: 22 },
    attachmentThumbnail: {
        width: 180,
        height: 140,
        borderRadius: 10,
        marginBottom: 6,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: { fontSize: 24, fontWeight: '700', marginBottom: 8, color: '#1a1a1a' },
    emptySubtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
    quickPrompts: { gap: 10, width: '100%' },
    chip: {
        borderWidth: 1,
        borderColor: '#007AFF',
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    chipText: { color: '#007AFF', fontSize: 14, fontWeight: '500' },
    attachmentPreviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    attachmentPreview: {
        width: 56,
        height: 56,
        borderRadius: 8,
    },
    attachmentRemove: {
        marginLeft: 6,
        backgroundColor: '#ff3b30',
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    attachmentRemoveIcon: { color: '#fff', fontSize: 12, fontWeight: '700' },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        gap: 8,
    },
    attachButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        maxHeight: 120,
        backgroundColor: '#fafafa',
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: { opacity: 0.6 },
    sendIcon: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
