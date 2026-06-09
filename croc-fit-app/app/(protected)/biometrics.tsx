/**
 * Biometrics screen — daily log form + 7/30-day trend.
 * Implements REQ-016, REQ-017, REQ-018.
 */

import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../lib/api';

interface BiometricEntry {
    id: string;
    date: string;
    weight_kg?: number;
    sleep_hours?: number;
    readiness?: number;
    resting_hr?: number;
    hrv?: number;
}

interface LogForm {
    date: string;
    weight_kg: string;
    sleep_hours: string;
    readiness: string;
    resting_hr: string;
    hrv: string;
}

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function readinessColor(r: number): string {
    if (r >= 8) return '#34C759';
    if (r >= 5) return '#FF9500';
    return '#FF3B30';
}

const EMPTY_FORM: LogForm = {
    date: todayISO(),
    weight_kg: '',
    sleep_hours: '',
    readiness: '',
    resting_hr: '',
    hrv: '',
};

export default function BiometricsScreen(): React.JSX.Element {
    const { session } = useAuth();
    const [entries, setEntries] = useState<BiometricEntry[]>([]);
    const [days, setDays] = useState<7 | 30>(7);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState<LogForm>(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const userId = session?.user?.id ?? '';
    const accessToken = session?.access_token;

    function fetchEntries(d: 7 | 30 = days): void {
        if (!userId) return;
        setIsLoading(true);
        apiGet<BiometricEntry[]>('/api/v1/biometrics', { user_id: userId, days: String(d) }, accessToken)
            .then((data) => setEntries([...data].reverse()))
            .catch((err: Error) => setError(err.message))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        fetchEntries(days);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, days]);

    function openLog(): void {
        setForm({ ...EMPTY_FORM, date: todayISO() });
        setSaveError(null);
        setShowModal(true);
    }

    async function handleSave(): Promise<void> {
        if (!form.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            setSaveError('Date must be YYYY-MM-DD');
            return;
        }
        setIsSaving(true);
        setSaveError(null);
        try {
            const payload: Record<string, string | number> = { date: form.date };
            if (form.weight_kg) payload['weight_kg'] = parseFloat(form.weight_kg);
            if (form.sleep_hours) payload['sleep_hours'] = parseFloat(form.sleep_hours);
            if (form.readiness) payload['readiness'] = parseInt(form.readiness, 10);
            if (form.resting_hr) payload['resting_hr'] = parseInt(form.resting_hr, 10);
            if (form.hrv) payload['hrv'] = parseFloat(form.hrv);

            await apiPost<BiometricEntry>('/api/v1/biometrics', payload, { user_id: userId }, accessToken);
            setShowModal(false);
            fetchEntries(days);
        } catch (err: unknown) {
            setSaveError(err instanceof Error ? err.message : 'Save failed');
        } finally {
            setIsSaving(false);
        }
    }

    const renderEntry = ({ item }: { item: BiometricEntry }): React.JSX.Element => (
        <View
            style={styles.entryCard}
            accessibilityLabel={`${item.date}: weight ${item.weight_kg ?? '-'} kg, sleep ${item.sleep_hours ?? '-'} h, readiness ${item.readiness ?? '-'}`}
        >
            <Text style={styles.entryDate}>{item.date}</Text>
            <View style={styles.metricsRow}>
                <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Weight</Text>
                    <Text style={styles.metricValue}>{item.weight_kg ?? '—'}</Text>
                    <Text style={styles.metricUnit}>kg</Text>
                </View>
                <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Sleep</Text>
                    <Text style={styles.metricValue}>{item.sleep_hours ?? '—'}</Text>
                    <Text style={styles.metricUnit}>h</Text>
                </View>
                <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Readiness</Text>
                    <Text
                        style={[
                            styles.metricValue,
                            item.readiness != null && { color: readinessColor(item.readiness) },
                        ]}
                    >
                        {item.readiness ?? '—'}
                    </Text>
                    <Text style={styles.metricUnit}>/10</Text>
                </View>
                {item.resting_hr != null && (
                    <View style={styles.metric}>
                        <Text style={styles.metricLabel}>HR rest</Text>
                        <Text style={styles.metricValue}>{item.resting_hr}</Text>
                        <Text style={styles.metricUnit}>bpm</Text>
                    </View>
                )}
            </View>
        </View>
    );

    const modal = (
        <Modal
            visible={showModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowModal(false)}
            accessibilityViewIsModal
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle} accessibilityRole="header">
                        Log biometrics
                    </Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Text style={styles.fieldLabel}>Date (YYYY-MM-DD) *</Text>
                        <TextInput
                            style={styles.input}
                            value={form.date}
                            onChangeText={(v) => setForm((f) => ({ ...f, date: v }))}
                            placeholder="2025-01-01"
                            accessibilityLabel="Date"
                        />
                        <Text style={styles.fieldLabel}>Weight (kg)</Text>
                        <TextInput
                            style={styles.input}
                            value={form.weight_kg}
                            onChangeText={(v) => setForm((f) => ({ ...f, weight_kg: v }))}
                            placeholder="e.g. 82.5"
                            keyboardType="decimal-pad"
                            accessibilityLabel="Weight in kg"
                        />
                        <Text style={styles.fieldLabel}>Sleep (hours)</Text>
                        <TextInput
                            style={styles.input}
                            value={form.sleep_hours}
                            onChangeText={(v) => setForm((f) => ({ ...f, sleep_hours: v }))}
                            placeholder="e.g. 7.5"
                            keyboardType="decimal-pad"
                            accessibilityLabel="Sleep hours"
                        />
                        <Text style={styles.fieldLabel}>Readiness (1-10)</Text>
                        <TextInput
                            style={styles.input}
                            value={form.readiness}
                            onChangeText={(v) => setForm((f) => ({ ...f, readiness: v }))}
                            placeholder="e.g. 8"
                            keyboardType="number-pad"
                            accessibilityLabel="Readiness score 1 to 10"
                        />
                        <Text style={styles.fieldLabel}>Resting HR (bpm)</Text>
                        <TextInput
                            style={styles.input}
                            value={form.resting_hr}
                            onChangeText={(v) => setForm((f) => ({ ...f, resting_hr: v }))}
                            placeholder="e.g. 52"
                            keyboardType="number-pad"
                            accessibilityLabel="Resting heart rate"
                        />
                        <Text style={styles.fieldLabel}>HRV (ms)</Text>
                        <TextInput
                            style={styles.input}
                            value={form.hrv}
                            onChangeText={(v) => setForm((f) => ({ ...f, hrv: v }))}
                            placeholder="e.g. 68"
                            keyboardType="decimal-pad"
                            accessibilityLabel="Heart rate variability in milliseconds"
                        />
                        {saveError ? (
                            <Text style={styles.saveError} accessibilityRole="alert">
                                {saveError}
                            </Text>
                        ) : null}
                        <View style={styles.modalActions}>
                            <Pressable
                                style={styles.cancelBtn}
                                onPress={() => setShowModal(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Cancel"
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                                onPress={handleSave}
                                disabled={isSaving}
                                accessibilityRole="button"
                                accessibilityLabel="Save biometrics"
                            >
                                <Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Save'}</Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#007AFF" accessibilityLabel="Loading biometrics" />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText} accessibilityRole="alert">
                    {error}
                </Text>
            </View>
        );
    }

    return (
        <>
            <View style={styles.container}>
                <View style={styles.toggle}>
                    <Pressable
                        style={[styles.toggleBtn, days === 7 && styles.toggleBtnActive]}
                        onPress={() => setDays(7)}
                        accessibilityRole="button"
                        accessibilityLabel="7 day trend"
                        accessibilityState={{ selected: days === 7 }}
                    >
                        <Text style={[styles.toggleText, days === 7 && styles.toggleTextActive]}>7d</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.toggleBtn, days === 30 && styles.toggleBtnActive]}
                        onPress={() => setDays(30)}
                        accessibilityRole="button"
                        accessibilityLabel="30 day trend"
                        accessibilityState={{ selected: days === 30 }}
                    >
                        <Text style={[styles.toggleText, days === 30 && styles.toggleTextActive]}>30d</Text>
                    </Pressable>
                </View>

                {entries.length === 0 ? (
                    <View style={styles.centered}>
                        <Text style={styles.emptyText}>No entries for this period.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={entries}
                        keyExtractor={(e) => e.id}
                        renderItem={renderEntry}
                        contentContainerStyle={styles.list}
                        accessibilityRole="list"
                        accessibilityLabel="Biometric entries"
                    />
                )}

                <Pressable
                    style={styles.fab}
                    onPress={openLog}
                    accessibilityRole="button"
                    accessibilityLabel="Log today's biometrics"
                >
                    <Text style={styles.fabText} aria-hidden>+</Text>
                </Pressable>
            </View>
            {modal}
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    list: { padding: 16, paddingBottom: 90, gap: 10 },
    toggle: {
        flexDirection: 'row',
        margin: 16,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#007AFF',
        alignSelf: 'flex-start',
    },
    toggleBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#fff' },
    toggleBtnActive: { backgroundColor: '#007AFF' },
    toggleText: { fontSize: 14, fontWeight: '600', color: '#007AFF' },
    toggleTextActive: { color: '#fff' },
    entryCard: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eee',
        padding: 16,
        backgroundColor: '#fff',
    },
    entryDate: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 12 },
    metricsRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
    metric: { alignItems: 'center', minWidth: 60 },
    metricLabel: { fontSize: 10, color: '#aaa', marginBottom: 2 },
    metricValue: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
    metricUnit: { fontSize: 10, color: '#888', marginTop: 1 },
    emptyText: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
    errorText: { fontSize: 15, color: '#d00', textAlign: 'center' },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    fabText: { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '300' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        maxHeight: '85%',
    },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
    fieldLabel: { fontSize: 13, color: '#555', marginTop: 12, marginBottom: 4 },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: '#1a1a1a',
        backgroundColor: '#fafafa',
    },
    saveError: { color: '#FF3B30', fontSize: 13, marginTop: 8 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 8 },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ccc',
        alignItems: 'center',
    },
    cancelText: { color: '#555', fontWeight: '600' },
    saveBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#007AFF',
        alignItems: 'center',
    },
    saveBtnDisabled: { backgroundColor: '#aaa' },
    saveText: { color: '#fff', fontWeight: '700' },
});
