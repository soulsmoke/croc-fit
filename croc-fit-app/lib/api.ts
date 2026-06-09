/**
 * API client for CrocFit backend.
 * Handles SSE streaming chat and REST calls.
 */

import Constants from 'expo-constants';
import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';

import { config } from './config';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatRequest {
    thread_id: string;
    message: string;
    user_id: string;
    history: ChatMessage[];
}

/**
 * Resolve the API URL — on iOS dev builds, replace localhost with the Metro host IP.
 */
function resolveApiUrl(rawUrl: string): string {
    if (Platform.OS === 'ios' && __DEV__) {
        const metroHost =
            Constants.expoConfig?.hostUri?.split(':')[0] ||
            (Constants as Record<string, any>).expoGoConfig?.debuggerHost?.split(':')[0] ||
            (Constants as Record<string, any>).platform?.hostUri?.split(':')[0];
        if (metroHost && metroHost !== 'localhost' && metroHost !== '127.0.0.1') {
            return rawUrl.replace(/localhost|127\.0\.0\.1/, metroHost);
        }
    }
    return rawUrl;
}

/**
 * Stream a chat message to the CrocFit AI coach.
 *
 * @param request - Chat request payload.
 * @param onToken - Callback called on each accumulated token chunk.
 * @param accessToken - Optional Bearer token for authenticated requests.
 * @param signal - Optional AbortSignal to cancel the stream.
 * @returns The final accumulated response string.
 */
export async function streamChat(
    request: ChatRequest,
    onToken: (accumulated: string) => void,
    accessToken?: string,
    signal?: AbortSignal,
): Promise<{ response: string }> {
    const apiUrl = resolveApiUrl(config.apiUrl);

    const response = await fetch(`${apiUrl}/api/v1/chat/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(request),
        signal,
    });

    if (!response.ok) {
        throw new Error(`Chat stream failed: HTTP ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
                const json = JSON.parse(line.slice(6)) as Record<string, unknown>;
                if (typeof json['chunk'] === 'string') {
                    accumulated += json['chunk'];
                    onToken(accumulated);
                } else if (typeof json['error'] === 'string') {
                    accumulated += `\n⚠️ ${json['error']}`;
                    onToken(accumulated);
                }
            } catch {
                // Partial chunk — skip
            }
        }
    }

    return { response: accumulated };
}

/**
 * Generic authenticated GET request helper.
 *
 * @param path - API path (e.g. "/api/v1/prs").
 * @param params - Query parameters.
 * @param accessToken - Optional Bearer token.
 * @returns Parsed JSON response.
 */
export async function apiGet<T>(
    path: string,
    params: Record<string, string> = {},
    accessToken?: string,
): Promise<T> {
    const apiUrl = resolveApiUrl(config.apiUrl);
    const query = new URLSearchParams(params).toString();
    const url = query ? `${apiUrl}${path}?${query}` : `${apiUrl}${path}`;

    const res = await fetch(url, {
        headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
    });

    if (!res.ok) throw new Error(`GET ${path} failed: HTTP ${res.status}`);
    return res.json() as Promise<T>;
}

/**
 * Generic authenticated POST request helper.
 *
 * @param path - API path (e.g. "/api/v1/workouts").
 * @param body - Request body (JSON-serialisable).
 * @param params - Optional query parameters.
 * @param accessToken - Optional Bearer token.
 * @returns Parsed JSON response.
 */
export async function apiPost<T>(
    path: string,
    body: unknown,
    params: Record<string, string> = {},
    accessToken?: string,
): Promise<T> {
    const apiUrl = resolveApiUrl(config.apiUrl);
    const query = new URLSearchParams(params).toString();
    const url = query ? `${apiUrl}${path}?${query}` : `${apiUrl}${path}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`POST ${path} failed: HTTP ${res.status}`);
    return res.json() as Promise<T>;
}

/**
 * Generic authenticated PUT request helper.
 *
 * @param path - API path.
 * @param body - Request body (JSON-serialisable).
 * @param accessToken - Optional Bearer token.
 * @param params - Optional query parameters.
 * @returns Parsed JSON response.
 */
export async function apiPut<T>(
    path: string,
    body: unknown,
    accessToken?: string,
    params: Record<string, string> = {},
): Promise<T> {
    const apiUrl = resolveApiUrl(config.apiUrl);
    const query = new URLSearchParams(params).toString();
    const url = query ? `${apiUrl}${path}?${query}` : `${apiUrl}${path}`;

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`PUT ${path} failed: HTTP ${res.status}`);
    return res.json() as Promise<T>;
}

/**
 * Generic authenticated PATCH request helper.
 *
 * @param path - API path (e.g. "/api/v1/workouts/123").
 * @param body - Partial update body.
 * @param accessToken - Optional Bearer token.
 * @returns Parsed JSON response.
 */
export async function apiPatch<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
    const apiUrl = resolveApiUrl(config.apiUrl);

    const res = await fetch(`${apiUrl}${path}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`PATCH ${path} failed: HTTP ${res.status}`);
    return res.json() as Promise<T>;
}

/**
 * Send a DELETE request to the CrocFit API.
 *
 * @param path - API path (e.g. '/api/v1/workouts/abc123').
 * @param accessToken - Optional Bearer token.
 * @returns void on 204, parsed JSON otherwise.
 */
export async function apiDelete(path: string, accessToken?: string): Promise<void> {
    const apiUrl = resolveApiUrl(config.apiUrl);

    const res = await fetch(`${apiUrl}${path}`, {
        method: 'DELETE',
        headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
    });

    if (!res.ok) throw new Error(`DELETE ${path} failed: HTTP ${res.status}`);
}

export interface AttachmentRecord {
    id: string;
    user_id: string;
    filename: string;
    content_type: string;
    size_bytes: number;
    storage_path: string;
    public_url: string | null;
    created_at: string;
}

/**
 * Upload an image or document to the CrocFit backend.
 *
 * @param fileUri - Local file URI from expo-image-picker.
 * @param filename - Original file name.
 * @param mimeType - MIME type of the file.
 * @param userId - Authenticated user ID.
 * @param accessToken - Bearer token.
 * @returns Created attachment record from the API.
 */
export async function uploadAttachment(
    fileUri: string,
    filename: string,
    mimeType: string,
    userId: string,
    accessToken: string,
): Promise<AttachmentRecord> {
    const apiUrl = resolveApiUrl(config.apiUrl);
    const url = `${apiUrl}/api/v1/attachments/upload?user_id=${encodeURIComponent(userId)}`;

    const formData = new FormData();
    if (Platform.OS === 'web') {
        // On web the standard fetch does not understand the RN { uri, name, type } shorthand.
        // Fetch the data URL / blob URL returned by expo-image-picker and build a real Blob.
        const blobRes = await fetch(fileUri);
        const blob = await blobRes.blob();
        formData.append('file', blob, filename);
    } else {
        // React Native native: the polyfilled fetch understands { uri, name, type }
        formData.append('file', { uri: fileUri, name: filename, type: mimeType } as unknown as Blob);
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
    });

    if (!res.ok) {
        const err = (await res.json().catch(() => ({ detail: 'Upload failed' }))) as { detail?: string };
        throw new Error(err.detail ?? `Upload failed: HTTP ${res.status}`);
    }
    return res.json() as Promise<AttachmentRecord>;
}
