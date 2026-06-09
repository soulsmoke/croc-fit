/**
 * Session detail screen — redesigned layout with block icons, block-level
 * completion, and PR-based load percentages.
 * Implements REQ-009, REQ-010, REQ-012.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { useAuth } from '../../contexts/AuthContext';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkoutExercise {
    id: string;
    name: string;
    sets?: number;
    reps?: string;
    load_kg?: number;
    load_notes?: string;
    completed: boolean;
    ex_notes: string;
    position: number;
}

interface WorkoutBlock {
    id: string;
    block_type: 'warm_up' | 'work' | 'cool_down' | 'accessory';
    title: string;
    description?: string;
    format?: string;
    notes?: string;
    position: number;
    workout_exercises: WorkoutExercise[];
}

interface WorkoutSession {
    id: string;
    title: string;
    scheduled_date: string;
    status: 'planned' | 'completed' | 'skipped';
    rpe?: number;
    feedback?: string;
    notes?: string;
    workout_blocks: WorkoutBlock[];
}

interface PR {
    exercise_name: string;
    weight_kg: number;
}

type PrMap = Map<string, number>; // exercise_name.toLowerCase() -> weight_kg

// ── Constants ─────────────────────────────────────────────────────────────────

const RPE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface BlockConfig {
    label: string;
    icon: IoniconsName;
    color: string;
}

const BLOCK_CONFIG: Record<WorkoutBlock['block_type'], BlockConfig> = {
    warm_up:   { label: 'WARM-UP',   icon: 'flash',        color: '#8B5CF6' },
    work:      { label: 'WOD',       icon: 'barbell',      color: '#22C55E' },
    accessory: { label: 'ACCESSORI', icon: 'fitness',      color: '#F59E0B' },
    cool_down: { label: 'COOL-DOWN', icon: 'leaf',         color: '#3B82F6' },
};

const STATUS_COLORS: Record<string, string> = {
    planned:   '#A78BFA',
    completed: '#34C759',
    skipped:   '#FF3B30',
};

const STATUS_LABELS: Record<string, string> = {
    planned:   'Pianificata',
    completed: 'Completata',
    skipped:   'Saltata',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateIT(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
    const weekday = d.toLocaleDateString('it-IT', { weekday: 'long' });
    const monthName = d.toLocaleDateString('it-IT', { month: 'long' });
    return `${cap(weekday)} ${day} ${cap(monthName)}`;
}

function findPrWeight(prMap: PrMap, name: string): number | null {
    const key = name.toLowerCase().trim();
    if (prMap.has(key)) return prMap.get(key) ?? null;
    for (const [prName, w] of prMap) {
        if (key.includes(prName) || prName.includes(key)) return w;
    }
    return null;
}

function formatLoad(exercise: WorkoutExercise, prMap: PrMap): string {
    if (!exercise.load_kg && !exercise.load_notes) return '';
    if (!exercise.load_kg) return exercise.load_notes!;
    const pr = findPrWeight(prMap, exercise.name);
    const pct = pr ? ` (${Math.round((exercise.load_kg / pr) * 100)}%)` : '';
    const suffix = exercise.load_notes ? ` \u2014 ${exercise.load_notes}` : '';
    return `${exercise.load_kg}kg${pct}${suffix}`;
}

function isBlockComplete(block: WorkoutBlock): boolean {
    return block.workout_exercises.length > 0 && block.workout_exercises.every((e) => e.completed);
}

function blockProgress(block: WorkoutBlock): number {
    if (block.workout_exercises.length === 0) return 0;
    return block.workout_exercises.filter((e) => e.completed).length / block.workout_exercises.length;
}

// ── ExerciseRow ───────────────────────────────────────────────────────────────

interface ExerciseRowProps {
    exercise: WorkoutExercise;
    color: string;
    prMap: PrMap;
}

function ExerciseRow({ exercise, color, prMap }: ExerciseRowProps): React.JSX.Element {
    const setsStr = exercise.sets ? `${exercise.sets}\u00d7` : '';
    const repsLabel = [setsStr, exercise.reps].filter(Boolean).join('');
    const loadStr = formatLoad(exercise, prMap);

    return (
        <View
            style={exStyles.row}
            accessible
            accessibilityLabel={[exercise.name, repsLabel, loadStr].filter(Boolean).join(', ')}
        >
            {repsLabel ? (
                <Text style={[exStyles.reps, { color }]}>{repsLabel}</Text>
            ) : (
                <View style={exStyles.bullet}>
                    <View style={[exStyles.dot, { backgroundColor: color }]} />
                </View>
            )}
            <View style={exStyles.info}>
                <Text style={exStyles.name} numberOfLines={1}>{exercise.name}</Text>
                {loadStr ? <Text style={exStyles.load}>{loadStr}</Text> : null}
                {exercise.ex_notes ? <Text style={exStyles.exNotes}>{exercise.ex_notes}</Text> : null}
            </View>
        </View>
    );
}

const exStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9 },
    reps: { fontSize: 16, fontWeight: '700', minWidth: 40, textAlign: 'right', flexShrink: 0, lineHeight: 22 },
    bullet: { width: 40, alignItems: 'flex-end', paddingTop: 8, flexShrink: 0 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    info: { flex: 1 },
    name: { fontSize: 15, fontWeight: '500', color: '#1a1a1a', lineHeight: 22 },
    load: { fontSize: 13, color: '#666', marginTop: 2 },
    exNotes: { fontSize: 12, color: '#aaa', fontStyle: 'italic', marginTop: 2 },
});

// ── BlockCard ─────────────────────────────────────────────────────────────────

interface BlockCardProps {
    block: WorkoutBlock;
    canComplete: boolean;
    prMap: PrMap;
    onBlockToggle: (block: WorkoutBlock, completed: boolean) => Promise<void>;
    defaultExpanded?: boolean;
}

function BlockCard({
    block,
    canComplete,
    prMap,
    onBlockToggle,
    defaultExpanded = false,
}: BlockCardProps): React.JSX.Element {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [isTogglingBlock, setIsTogglingBlock] = useState(false);

    const config = BLOCK_CONFIG[block.block_type];
    const exercises = [...block.workout_exercises].sort((a, b) => a.position - b.position);
    const allDone = isBlockComplete(block);
    const progress = blockProgress(block);
    const progressPct = Math.round(progress * 100);

    async function handleBlockToggle(): Promise<void> {
        if (!canComplete || isTogglingBlock) return;
        setIsTogglingBlock(true);
        try {
            await onBlockToggle(block, !allDone);
        } finally {
            setIsTogglingBlock(false);
        }
    }

    return (
        <View style={bStyles.card}>
            {/* Header */}
            <View style={bStyles.header}>
                <View style={[bStyles.iconCircle, { backgroundColor: config.color }]}>
                    <Ionicons name={config.icon} size={20} color="#fff" />
                </View>

                <Pressable
                    style={bStyles.titleArea}
                    onPress={() => setExpanded((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={`${config.label}. ${expanded ? 'Comprimi' : 'Espandi'}`}
                    accessibilityState={{ expanded }}
                >
                    <Text style={[bStyles.blockType, { color: config.color }]}>{config.label}</Text>
                    {block.title && block.title !== config.label ? (
                        <Text style={bStyles.blockTitle} numberOfLines={1}>{block.title}</Text>
                    ) : null}
                </Pressable>

                <View style={bStyles.rightActions}>
                    {canComplete && exercises.length > 0 && (
                        <Pressable
                            style={[
                                bStyles.blockCheck,
                                allDone
                                    ? { backgroundColor: '#34C759', borderColor: '#34C759' }
                                    : { borderColor: progress > 0 ? config.color : '#d0d0d0' },
                            ]}
                            onPress={handleBlockToggle}
                            disabled={isTogglingBlock}
                            accessibilityRole="checkbox"
                            accessibilityLabel={allDone ? 'Blocco completato' : 'Segna blocco come completato'}
                            accessibilityState={{ checked: allDone, disabled: isTogglingBlock }}
                        >
                            {isTogglingBlock ? (
                                <ActivityIndicator size="small" color={allDone ? '#fff' : config.color} />
                            ) : allDone ? (
                                <Ionicons name="checkmark" size={14} color="#fff" />
                            ) : progress > 0 ? (
                                <Text style={[bStyles.blockCheckPct, { color: config.color }]}>{progressPct}%</Text>
                            ) : null}
                        </Pressable>
                    )}
                    <Pressable
                        onPress={() => setExpanded((v) => !v)}
                        accessibilityLabel={expanded ? 'Comprimi' : 'Espandi'}
                        accessibilityRole="button"
                        hitSlop={8}
                    >
                        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="#bbb" />
                    </Pressable>
                </View>
            </View>

            {/* Progress bar */}
            {exercises.length > 0 && (
                <View style={bStyles.progressTrack}>
                    <View
                        style={[
                            bStyles.progressFill,
                            {
                                width: `${progressPct}%` as `${number}%`,
                                backgroundColor: allDone ? '#34C759' : config.color,
                            },
                        ]}
                    />
                </View>
            )}

            {/* Body */}
            {expanded && (
                <View style={bStyles.body}>
                    {block.description ? <Text style={bStyles.description}>{block.description}</Text> : null}

                    {block.format ? (
                        <View style={bStyles.formatRow}>
                            <View style={[bStyles.formatTag, { backgroundColor: config.color + '18', borderColor: config.color + '44' }]}>
                                <Text style={[bStyles.formatTagText, { color: config.color }]}>{block.format}</Text>
                            </View>
                        </View>
                    ) : null}

                    {exercises.length > 0 ? (
                        exercises.map((ex, idx) => (
                            <View key={ex.id}>
                                {idx > 0 && <View style={bStyles.divider} />}
                                <ExerciseRow exercise={ex} color={config.color} prMap={prMap} />
                            </View>
                        ))
                    ) : (
                        <Text style={bStyles.emptyExercises}>Nessun esercizio</Text>
                    )}

                    {block.notes ? (
                        <View style={[bStyles.goalBox, { borderLeftColor: config.color }]}>
                            <Ionicons name="trophy-outline" size={13} color={config.color} />
                            <Text style={[bStyles.goalText, { color: config.color }]}>Goal: {block.notes}</Text>
                        </View>
                    ) : null}
                </View>
            )}
        </View>
    );
}

const bStyles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.07,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 3,
    },
    header: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
    iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    titleArea: { flex: 1, gap: 2 },
    blockType: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
    blockTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
    rightActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
    blockCheck: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    blockCheckPct: { fontSize: 9, fontWeight: '800' },
    progressTrack: { height: 3, backgroundColor: '#f0f0f0' },
    progressFill: { height: 3 },
    body: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 6 },
    description: { fontSize: 13, color: '#666', fontStyle: 'italic', marginBottom: 8 },
    formatRow: { marginBottom: 8 },
    formatTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    formatTagText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
    divider: { height: 1, backgroundColor: '#f5f5f5' },
    emptyExercises: { fontSize: 14, color: '#aaa', paddingVertical: 8 },
    goalBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fafafa', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderLeftWidth: 3, marginTop: 10 },
    goalText: { fontSize: 12, fontWeight: '600', flex: 1 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SessionDetailScreen(): React.JSX.Element {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { session } = useAuth();
    const navigation = useNavigation();

    const [workout, setWorkout] = useState<WorkoutSession | null>(null);
    const [prMap, setPrMap] = useState<PrMap>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [rpe, setRpe] = useState<number>(7);
    const [feedback, setFeedback] = useState('');
    const [isCompleting, setIsCompleting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const accessToken = session?.access_token;
    const userId = session?.user?.id ?? '';

    useLayoutEffect(() => {
        navigation.setOptions({ title: workout?.title ?? 'Sessione' });
    }, [navigation, workout?.title]);

    useEffect(() => {
        if (!id) return;
        Promise.all([
            apiGet<WorkoutSession>(`/api/v1/workouts/${id}`, {}, accessToken),
            userId ? apiGet<PR[]>('/api/v1/prs', { user_id: userId }, accessToken) : Promise.resolve<PR[]>([]),
        ])
            .then(([data, prs]) => {
                setWorkout({
                    ...data,
                    workout_blocks: (data.workout_blocks ?? []).map((b) => ({
                        ...b,
                        workout_exercises: b.workout_exercises ?? [],
                    })),
                });
                const map: PrMap = new Map();
                for (const pr of prs) map.set(pr.exercise_name.toLowerCase().trim(), pr.weight_kg);
                setPrMap(map);
            })
            .catch((err: Error) => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [id, userId, accessToken]);

    async function handleBlockToggle(block: WorkoutBlock, completed: boolean): Promise<void> {
        if (block.workout_exercises.length === 0) return;
        try {
            await Promise.all(
                block.workout_exercises.map((e) =>
                    apiPatch<WorkoutExercise>(`/api/v1/exercises/${e.id}/complete`, { completed }, accessToken),
                ),
            );
            setWorkout((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    workout_blocks: prev.workout_blocks.map((b) =>
                        b.id === block.id
                            ? { ...b, workout_exercises: b.workout_exercises.map((e) => ({ ...e, completed })) }
                            : b,
                    ),
                };
            });
        } catch {
            Alert.alert('Errore', 'Impossibile aggiornare il blocco.');
        }
    }

    async function handleComplete(): Promise<void> {
        if (!id) return;
        setIsCompleting(true);
        try {
            await apiPost<WorkoutSession>(`/api/v1/workouts/${id}/complete`, { rpe, feedback }, {}, accessToken);
            setShowCompleteModal(false);
            setWorkout((prev) => (prev ? { ...prev, status: 'completed', rpe, feedback } : prev));
            Alert.alert('Sessione completata!', `RPE ${rpe}/10 registrato.`);
        } catch (err) {
            Alert.alert('Errore', err instanceof Error ? err.message : 'Impossibile completare la sessione.');
        } finally {
            setIsCompleting(false);
        }
    }

    function handleDeletePress(): void {
        Alert.alert(
            'Elimina sessione',
            `Vuoi eliminare "${workout?.title ?? 'questa sessione'}"? L'operazione non pu\u00f2 essere annullata.`,
            [
                { text: 'Annulla', style: 'cancel' },
                { text: 'Elimina', style: 'destructive', onPress: handleDeleteConfirm },
            ],
        );
    }

    async function handleDeleteConfirm(): Promise<void> {
        if (!id) return;
        setIsDeleting(true);
        try {
            await apiDelete(`/api/v1/workouts/${id}`, accessToken);
            router.back();
        } catch {
            Alert.alert('Errore', 'Impossibile eliminare la sessione.');
        } finally {
            setIsDeleting(false);
        }
    }

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#8B5CF6" accessibilityLabel="Caricamento sessione" />
            </View>
        );
    }

    if (error || !workout) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText} accessibilityRole="alert">{error ?? 'Sessione non trovata'}</Text>
                <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Torna indietro">
                    <Text style={styles.backButtonText}>Torna indietro</Text>
                </Pressable>
            </View>
        );
    }

    const sortedBlocks = [...workout.workout_blocks].sort((a, b) => a.position - b.position);
    const totalEx = sortedBlocks.reduce((s, b) => s + b.workout_exercises.length, 0);
    const completedEx = sortedBlocks.reduce((s, b) => s + b.workout_exercises.filter((e) => e.completed).length, 0);
    const canComplete = workout.status === 'planned';
    const statusColor = STATUS_COLORS[workout.status] ?? '#999';
    const overviewPct = totalEx > 0 ? Math.round((completedEx / totalEx) * 100) : 0;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Dark header */}
            <View style={styles.darkHeader}>
                <Text style={styles.headerDate}>{formatDateIT(workout.scheduled_date)}</Text>
                <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={2}>
                    {workout.title}
                </Text>
                {workout.notes ? <Text style={styles.headerNotes} numberOfLines={2}>{workout.notes}</Text> : null}
                <View style={styles.headerMeta}>
                    <View style={[styles.statusPill, { backgroundColor: statusColor + '33' }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusPillText, { color: statusColor }]}>
                            {STATUS_LABELS[workout.status] ?? workout.status}
                        </Text>
                    </View>
                    {totalEx > 0 && (
                        <View style={styles.metaChip}>
                            <Ionicons name="flash" size={11} color="rgba(255,255,255,0.55)" />
                            <Text style={styles.metaChipText}>{sortedBlocks.length} blocchi \u00b7 {totalEx} esercizi</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* White content area */}
            <View style={styles.mainContent}>
                {/* Overall progress bar */}
                {totalEx > 0 && canComplete && (
                    <View style={styles.overviewBar}>
                        <View style={styles.overviewLeft}>
                            <Ionicons name="checkmark-circle-outline" size={16} color="#666" />
                            <Text style={styles.overviewText}>{completedEx}/{totalEx} completati</Text>
                        </View>
                        <View style={styles.overviewTrack}>
                            <View style={[styles.overviewFill, { width: `${overviewPct}%` as `${number}%` }]} />
                        </View>
                    </View>
                )}

                {/* Blocks */}
                {sortedBlocks.length > 0 ? (
                    sortedBlocks.map((block, idx) => (
                        <BlockCard
                            key={block.id}
                            block={block}
                            canComplete={canComplete}
                            prMap={prMap}
                            onBlockToggle={handleBlockToggle}
                            defaultExpanded={idx === 0}
                        />
                    ))
                ) : (
                    <View style={styles.emptyCard}>
                        <Ionicons name="barbell-outline" size={40} color="#ccc" />
                        <Text style={styles.emptyText}>Nessun blocco \u2014 chiedi all&apos;AI di creare la sessione.</Text>
                    </View>
                )}

                {/* Post-workout log */}
                {workout.status === 'completed' && (
                    <View style={styles.postWorkoutCard}>
                        <View style={styles.postWorkoutHeader}>
                            <Ionicons name="trophy" size={16} color="#F59E0B" />
                            <Text style={styles.sectionTitle}>Post-workout log</Text>
                        </View>
                        <View style={styles.statsGrid}>
                            {workout.rpe ? (
                                <View style={styles.statItem}>
                                    <Text style={styles.statVal}>{workout.rpe}<Text style={styles.statUnit}>/10</Text></Text>
                                    <Text style={styles.statLbl}>RPE</Text>
                                </View>
                            ) : null}
                            {totalEx > 0 && (
                                <View style={styles.statItem}>
                                    <Text style={styles.statVal}>{completedEx}<Text style={styles.statUnit}>/{totalEx}</Text></Text>
                                    <Text style={styles.statLbl}>Completati</Text>
                                </View>
                            )}
                        </View>
                        {workout.feedback ? <Text style={styles.feedbackText}>{workout.feedback}</Text> : null}
                    </View>
                )}

                {/* CTAs */}
                {canComplete && (
                    <Pressable
                        style={styles.primaryButton}
                        onPress={() => setShowCompleteModal(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Avvia sessione"
                    >
                        <Ionicons name="play" size={16} color="#fff" />
                        <Text style={styles.primaryButtonText}>AVVIA SESSIONE</Text>
                    </Pressable>
                )}

                <Pressable
                    style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
                    onPress={handleDeletePress}
                    disabled={isDeleting}
                    accessibilityRole="button"
                    accessibilityLabel="Elimina questa sessione"
                    accessibilityState={{ disabled: isDeleting }}
                >
                    {isDeleting ? (
                        <ActivityIndicator size="small" color="#FF3B30" />
                    ) : (
                        <Text style={styles.deleteButtonText}>Elimina sessione</Text>
                    )}
                </Pressable>
            </View>

            {/* Complete modal */}
            <Modal visible={showCompleteModal} transparent animationType="slide" onRequestClose={() => setShowCompleteModal(false)} accessibilityViewIsModal>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent} aria-modal aria-labelledby="modal-title">
                        <Text nativeID="modal-title" style={styles.modalTitle} accessibilityRole="header">Post-workout log</Text>
                        <Text style={styles.modalSubtitle}>Quanto \u00e8 stata intensa questa sessione?</Text>
                        <Text style={styles.rpeLabel}>RPE (1\u201310)</Text>
                        <View style={styles.rpeRow}>
                            {RPE_OPTIONS.map((v) => (
                                <Pressable
                                    key={v}
                                    style={[styles.rpeButton, rpe === v && styles.rpeButtonSelected]}
                                    onPress={() => setRpe(v)}
                                    accessibilityRole="radio"
                                    accessibilityLabel={`RPE ${v}`}
                                    accessibilityState={{ checked: rpe === v }}
                                >
                                    <Text style={[styles.rpeButtonText, rpe === v && styles.rpeButtonTextSelected]}>{v}</Text>
                                </Pressable>
                            ))}
                        </View>
                        <Text style={styles.feedbackLabel}>Note (opzionale)</Text>
                        <TextInput
                            style={styles.feedbackInput}
                            value={feedback}
                            onChangeText={setFeedback}
                            placeholder="Dolori, fatica, vittorie..."
                            multiline
                            numberOfLines={3}
                            accessibilityLabel="Note post-workout"
                        />
                        <Text style={styles.disclaimer}>\u26a0\ufe0f Consulta un professionista per qualsiasi preoccupazione sanitaria.</Text>
                        <View style={styles.modalButtons}>
                            <Pressable style={styles.cancelButton} onPress={() => setShowCompleteModal(false)} accessibilityRole="button" accessibilityLabel="Annulla">
                                <Text style={styles.cancelButtonText}>Annulla</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.confirmButton, isCompleting && styles.confirmButtonDisabled]}
                                onPress={handleComplete}
                                disabled={isCompleting}
                                accessibilityRole="button"
                                accessibilityLabel={`Conferma RPE ${rpe}`}
                                accessibilityState={{ disabled: isCompleting }}
                            >
                                {isCompleting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmButtonText}>Conferma</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1E1B4B' },
    content: { paddingBottom: 32 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f5f5f8' },
    errorText: { color: '#FF3B30', fontSize: 16, textAlign: 'center', marginBottom: 16 },
    backButton: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#8B5CF6', borderRadius: 8 },
    backButtonText: { color: '#fff', fontWeight: '600' },
    // Dark header
    darkHeader: { backgroundColor: '#1E1B4B', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, gap: 8 },
    headerDate: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
    headerTitle: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: 0.3, lineHeight: 36 },
    headerNotes: { fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 20 },
    headerMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusPillText: { fontSize: 12, fontWeight: '700' },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    metaChipText: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
    // White content
    mainContent: { backgroundColor: '#f0f0f5', borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24, padding: 16, gap: 12, minHeight: 400 },
    // Overview bar
    overviewBar: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
    overviewLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    overviewText: { fontSize: 13, color: '#555', fontWeight: '500' },
    overviewTrack: { flex: 1, height: 4, backgroundColor: '#eee', borderRadius: 2, overflow: 'hidden' },
    overviewFill: { height: 4, backgroundColor: '#8B5CF6', borderRadius: 2 },
    // Empty
    emptyCard: { backgroundColor: '#fff', borderRadius: 18, padding: 32, alignItems: 'center', gap: 12 },
    emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center' },
    // Post-workout
    postWorkoutCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    postWorkoutHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
    statsGrid: { flexDirection: 'row', gap: 24 },
    statItem: { alignItems: 'center' },
    statVal: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
    statUnit: { fontSize: 14, fontWeight: '500', color: '#aaa' },
    statLbl: { fontSize: 11, color: '#aaa', textTransform: 'uppercase', marginTop: 2, letterSpacing: 0.4 },
    feedbackText: { fontSize: 14, color: '#555', fontStyle: 'italic' },
    // Primary CTA
    primaryButton: { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: '#4F46E5', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4 },
    primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
    // Delete
    deleteButton: { borderWidth: 1.5, borderColor: '#FF3B30', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 4 },
    deleteButtonDisabled: { opacity: 0.5 },
    deleteButtonText: { color: '#FF3B30', fontSize: 14, fontWeight: '600' },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
    modalSubtitle: { fontSize: 14, color: '#666' },
    rpeLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
    rpeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    rpeButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' },
    rpeButtonSelected: { backgroundColor: '#4F46E5' },
    rpeButtonText: { fontSize: 14, fontWeight: '600', color: '#4F46E5' },
    rpeButtonTextSelected: { color: '#fff' },
    feedbackLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
    feedbackInput: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 10, padding: 12, fontSize: 14, color: '#1a1a1a', textAlignVertical: 'top', minHeight: 80 },
    disclaimer: { fontSize: 11, color: '#aaa', fontStyle: 'italic' },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
    cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e5e5', alignItems: 'center' },
    cancelButtonText: { fontSize: 15, fontWeight: '600', color: '#666' },
    confirmButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center' },
    confirmButtonDisabled: { opacity: 0.6 },
    confirmButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
