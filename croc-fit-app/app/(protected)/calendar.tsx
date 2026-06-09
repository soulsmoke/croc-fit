/**
 * Calendar screen — navigable day strip + sessions for the selected day.
 * The strip shows 7 days (Mon–Sun). Arrow buttons shift the visible week.
 * Defaults to today on mount.
 * Implements REQ-006 (calendar view), REQ-007 (create/complete sessions).
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../lib/api';

interface WorkoutSession {
    id: string;
    title: string;
    scheduled_date: string;
    status: 'planned' | 'completed' | 'skipped';
    rpe?: number;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
    return d.toISOString().split('T')[0]!;
}

function todayString(): string {
    return formatDate(new Date());
}

function getMondayOfWeek(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
}

function getWeekDays(monday: Date): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
    });
}

const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MONTH_NAMES = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
const MONTH_NAMES_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function formatDayHeader(dateStr: string): string {
    const today = todayString();
    if (dateStr === today) return 'Oggi';
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dayName = DAY_NAMES_SHORT[d.getDay()]!;
    return `${dayName} ${day} ${MONTH_NAMES_SHORT[month - 1]} ${year}`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CalendarScreen(): React.JSX.Element {
    const { session } = useAuth();
    const today = todayString();
    const { date: dateParam } = useLocalSearchParams<{ date?: string }>();

    // If navigated back from session detail with a date, select that day
    const initialDate = typeof dateParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

    const [selectedDate, setSelectedDate] = useState<string>(initialDate);
    const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date(initialDate.replace(/-/g, '/'))));
    const [sessions, setSessions] = useState<WorkoutSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDate, setNewDate] = useState(today);
    const [newNotes, setNewNotes] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const userId = session?.user?.id ?? '';
    const accessToken = session?.access_token;

    function fetchSessions(refreshing = false): void {
        if (!userId) return;
        if (refreshing) setIsRefreshing(true);
        const from = new Date(weekStart);
        from.setDate(weekStart.getDate() - 14);
        const to = new Date(weekStart);
        to.setDate(weekStart.getDate() + 28);
        apiGet<WorkoutSession[]>(
            '/api/v1/calendar',
            { user_id: userId, from_date: formatDate(from), to_date: formatDate(to) },
            accessToken,
        )
            .then(setSessions)
            .catch((err: Error) => console.warn('calendar fetch error:', err.message))
            .finally(() => {
                setIsLoading(false);
                setIsRefreshing(false);
            });
    }

    useEffect(() => {
        fetchSessions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // Sync selectedDate when navigating back with a new date param
    useEffect(() => {
        if (typeof dateParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            setSelectedDate(dateParam);
            setWeekStart(getMondayOfWeek(new Date(dateParam.replace(/-/g, '/'))));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateParam]);

    useFocusEffect(
        useCallback(() => {
            if (userId) fetchSessions();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [userId]),
    );

    function shiftWeek(delta: number): void {
        setWeekStart((prev) => {
            const next = new Date(prev);
            next.setDate(prev.getDate() + delta * 7);
            return next;
        });
    }

    async function handleCreate(): Promise<void> {
        if (!newTitle.trim()) {
            Alert.alert('Titolo richiesto', 'Inserisci un titolo per la sessione.');
            return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
            Alert.alert('Data non valida', 'Usa il formato YYYY-MM-DD.');
            return;
        }
        setIsCreating(true);
        try {
            await apiPost(
                '/api/v1/workouts',
                { title: newTitle.trim(), scheduled_date: newDate, notes: newNotes.trim() },
                { user_id: userId },
                accessToken,
            );
            setShowCreate(false);
            setNewTitle('');
            setNewNotes('');
            fetchSessions(true);
        } catch (err) {
            Alert.alert('Errore', err instanceof Error ? err.message : 'Impossibile creare la sessione');
        } finally {
            setIsCreating(false);
        }
    }

    const weekDays = getWeekDays(weekStart);
    const sessionDateSet = new Set(sessions.map((s) => s.scheduled_date));
    const daySessions = sessions.filter((s) => s.scheduled_date === selectedDate);

    const lastDay = weekDays[6]!;
    const monthLabel =
        weekStart.getMonth() === lastDay.getMonth()
            ? `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()}`
            : `${MONTH_NAMES_SHORT[weekStart.getMonth()]} – ${MONTH_NAMES_SHORT[lastDay.getMonth()]} ${lastDay.getFullYear()}`;

    const statusColor: Record<string, string> = {
        planned: '#007AFF',
        completed: '#34C759',
        skipped: '#FF3B30',
    };
    const statusLabel: Record<string, string> = {
        planned: 'Pianificata',
        completed: 'Completata',
        skipped: 'Saltata',
    };

    const renderSession = ({ item }: { item: WorkoutSession }): React.JSX.Element => (
        <Pressable
            style={styles.sessionCard}
            onPress={() => router.push(`/session/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${statusLabel[item.status] ?? item.status}. Tocca per aprire.`}
        >
            <View style={[styles.statusAccent, { backgroundColor: statusColor[item.status] ?? '#999' }]} />
            <View style={styles.sessionInfo}>
                <Text style={styles.sessionTitle}>{item.title}</Text>
                {item.rpe ? <Text style={styles.sessionMeta}>RPE {item.rpe}/10</Text> : null}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: (statusColor[item.status] ?? '#999') + '20' }]}>
                <Text style={[styles.statusText, { color: statusColor[item.status] ?? '#999' }]}>
                    {statusLabel[item.status] ?? item.status}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#ccc" style={{ marginRight: 12 }} />
        </Pressable>
    );

    return (
        <View style={styles.container}>
            {/* ── Week navigator ── */}
            <View style={styles.weekNav}>
                <Pressable
                    style={styles.navArrow}
                    onPress={() => shiftWeek(-1)}
                    accessibilityRole="button"
                    accessibilityLabel="Settimana precedente"
                >
                    <Ionicons name="chevron-back" size={22} color="#007AFF" />
                </Pressable>
                <Text style={styles.monthLabel}>{monthLabel}</Text>
                <Pressable
                    style={styles.navArrow}
                    onPress={() => shiftWeek(1)}
                    accessibilityRole="button"
                    accessibilityLabel="Settimana successiva"
                >
                    <Ionicons name="chevron-forward" size={22} color="#007AFF" />
                </Pressable>
            </View>

            {/* ── Day strip ── */}
            <View style={styles.dayStrip}>
                {weekDays.map((day) => {
                    const dateStr = formatDate(day);
                    const isSelected = dateStr === selectedDate;
                    const isToday = dateStr === today;
                    const hasSessions = sessionDateSet.has(dateStr);
                    const dayName = DAY_NAMES_SHORT[day.getDay()]!;
                    const dayNum = day.getDate();
                    return (
                        <Pressable
                            key={dateStr}
                            style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                            onPress={() => setSelectedDate(dateStr)}
                            accessibilityRole="button"
                            accessibilityLabel={`${dayName} ${dayNum}${hasSessions ? ', ha sessioni' : ''}`}
                            accessibilityState={{ selected: isSelected }}
                        >
                            <Text
                                style={[
                                    styles.dayName,
                                    isSelected && styles.dayNameSelected,
                                    isToday && !isSelected && styles.dayNameToday,
                                ]}
                            >
                                {dayName}
                            </Text>
                            <Text
                                style={[
                                    styles.dayNum,
                                    isSelected && styles.dayNumSelected,
                                    isToday && !isSelected && styles.dayNumToday,
                                ]}
                            >
                                {dayNum}
                            </Text>
                            <View
                                style={[
                                    styles.sessionDot,
                                    hasSessions
                                        ? isSelected
                                            ? styles.sessionDotOnSelected
                                            : styles.sessionDotVisible
                                        : styles.sessionDotHidden,
                                ]}
                            />
                        </Pressable>
                    );
                })}
            </View>

            {/* ── Day heading ── */}
            <View style={styles.dayHeader}>
                <Text style={styles.dayHeaderText}>{formatDayHeader(selectedDate)}</Text>
                {isRefreshing && <ActivityIndicator size="small" color="#007AFF" />}
            </View>

            {/* ── Session list ── */}
            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            ) : daySessions.length === 0 ? (
                <View style={styles.emptySessions}>
                    <Ionicons name="calendar-outline" size={40} color="#d0d0d0" />
                    <Text style={styles.emptyText}>{'Nessuna sessione\nTocca + per pianificarne una'}</Text>
                </View>
            ) : (
                <FlatList
                    data={daySessions}
                    keyExtractor={(s) => s.id}
                    renderItem={renderSession}
                    contentContainerStyle={styles.sessionList}
                    onRefresh={() => fetchSessions(true)}
                    refreshing={isRefreshing}
                    accessibilityRole="list"
                    accessibilityLabel="Sessioni del giorno"
                />
            )}

            {/* ── FAB ── */}
            <Pressable
                style={styles.fab}
                onPress={() => {
                    setNewDate(selectedDate);
                    setShowCreate(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Crea nuova sessione"
            >
                <Ionicons name="add" size={28} color="#fff" />
            </Pressable>

            {/* ── Create session modal ── */}
            <Modal
                visible={showCreate}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCreate(false)}
                accessibilityViewIsModal
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent} aria-modal aria-labelledby="create-modal-title">
                        <Text nativeID="create-modal-title" style={styles.modalTitle} accessibilityRole="header">
                            Nuova sessione
                        </Text>

                        <Text style={styles.inputLabel}>Titolo *</Text>
                        <TextInput
                            style={styles.input}
                            value={newTitle}
                            onChangeText={setNewTitle}
                            placeholder="es. WOD lunedì"
                            autoFocus
                            accessibilityLabel="Titolo sessione"
                        />

                        <Text style={styles.inputLabel}>Data (YYYY-MM-DD) *</Text>
                        <TextInput
                            style={styles.input}
                            value={newDate}
                            onChangeText={setNewDate}
                            placeholder="2026-06-09"
                            accessibilityLabel="Data sessione in formato YYYY-MM-DD"
                        />

                        <Text style={styles.inputLabel}>Note</Text>
                        <TextInput
                            style={[styles.input, styles.inputMulti]}
                            value={newNotes}
                            onChangeText={setNewNotes}
                            placeholder="Focus, obiettivi, promemoria..."
                            multiline
                            numberOfLines={3}
                            accessibilityLabel="Note sessione"
                        />

                        <View style={styles.modalButtons}>
                            <Pressable
                                style={styles.cancelButton}
                                onPress={() => setShowCreate(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Annulla"
                            >
                                <Text style={styles.cancelButtonText}>Annulla</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.confirmButton, isCreating && styles.confirmButtonDisabled]}
                                onPress={handleCreate}
                                disabled={isCreating}
                                accessibilityRole="button"
                                accessibilityLabel="Salva nuova sessione"
                                accessibilityState={{ disabled: isCreating }}
                            >
                                {isCreating ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.confirmButtonText}>Salva</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },

    weekNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    navArrow: { padding: 8 },
    monthLabel: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },

    dayStrip: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 8,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    dayCell: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 2,
        borderRadius: 14,
        gap: 3,
    },
    dayCellSelected: { backgroundColor: '#007AFF' },
    dayName: { fontSize: 10, fontWeight: '600', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.3 },
    dayNameSelected: { color: 'rgba(255,255,255,0.75)' },
    dayNameToday: { color: '#007AFF' },
    dayNum: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', lineHeight: 22 },
    dayNumSelected: { color: '#fff' },
    dayNumToday: { color: '#007AFF' },
    sessionDot: { width: 5, height: 5, borderRadius: 3 },
    sessionDotVisible: { backgroundColor: '#007AFF' },
    sessionDotOnSelected: { backgroundColor: 'rgba(255,255,255,0.6)' },
    sessionDotHidden: { backgroundColor: 'transparent' },

    dayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    dayHeaderText: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },

    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptySessions: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingBottom: 80 },
    emptyText: { fontSize: 14, color: '#bbb', textAlign: 'center', lineHeight: 22 },
    sessionList: { paddingHorizontal: 16, paddingBottom: 88, gap: 10 },
    sessionCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 4,
        elevation: 1,
    },
    statusAccent: { width: 4, alignSelf: 'stretch' },
    sessionInfo: { flex: 1, paddingHorizontal: 14, paddingVertical: 14 },
    sessionTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
    sessionMeta: { fontSize: 12, color: '#888', marginTop: 2 },
    statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    statusText: { fontSize: 12, fontWeight: '600' },

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
        shadowColor: '#007AFF',
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        gap: 10,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
    inputLabel: { fontSize: 13, fontWeight: '600', color: '#444' },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#1a1a1a',
    },
    inputMulti: { textAlignVertical: 'top', minHeight: 72 },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#ddd',
        alignItems: 'center',
    },
    cancelButtonText: { fontSize: 15, fontWeight: '600', color: '#666' },
    confirmButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        backgroundColor: '#007AFF',
        alignItems: 'center',
    },
    confirmButtonDisabled: { opacity: 0.6 },
    confirmButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
