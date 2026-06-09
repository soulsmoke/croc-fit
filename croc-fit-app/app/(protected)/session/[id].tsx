/**
 * Session detail screen — light theme, block icons, block-level completion,
 * PR-based load percentages. Rendered inside the (protected) Tabs group so
 * the bottom navigation bar is always visible.
 * Implements REQ-009, REQ-010, REQ-012.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams, useNavigation, RelativePathString } from 'expo-router';
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

import { useAuth } from '../../../contexts/AuthContext';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../lib/api';

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

type PrMap = Map<string, number>;

// ── Constants ─────────────────────────────────────────────────────────────────

const RPE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface BlockConfig {
    label: string;
    icon: IoniconsName;
    color: string;
}

const BLOCK_CONFIG: Record<WorkoutBlock['block_type'], BlockConfig> = {
    warm_up:   { label: 'WARM-UP',   icon: 'flash',   color: '#FF9500' },
    work:      { label: 'WOD',       icon: 'barbell', color: '#007AFF' },
    accessory: { label: 'ACCESSORI', icon: 'fitness', color: '#34C759' },
    cool_down: { label: 'COOL-DOWN', icon: 'leaf',    color: '#5856D6' },
};

const STATUS_COLORS: Record<string, string> = {
    planned:   '#FF9500',
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
    // Skip computed % when load_notes already contains percentage or 1RM context
    const notes = exercise.load_notes ?? '';
    const notesHasPct = notes.includes('%') || /\brm\b/i.test(notes);
    const pr = notesHasPct ? null : findPrWeight(prMap, exercise.name);
    const pct = pr ? ` (${Math.round((exercise.load_kg / pr) * 100)}%)` : '';
    const suffix = notes ? ` \u2014 ${notes}` : '';
    return `${exercise.load_kg}kg${pct}${suffix}`;
}

/**
 * Returns true when the format string is already expressed by the title
 * (same, subset, or superset) — avoids showing duplicate info.
 */
function isFormatRedundant(title: string, format: string): boolean {
    const t = title.toLowerCase().trim();
    const f = format.toLowerCase().trim();
    return t === f || t.includes(f) || f.includes(t);
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
    onEdit?: () => void;
    onDelete?: () => void;
}

function ExerciseRow({ exercise, color, prMap, onEdit, onDelete }: ExerciseRowProps): React.JSX.Element {
    const setsStr = exercise.sets ? `${exercise.sets}\u00d7` : '';
    const repsLabel = [setsStr, exercise.reps].filter(Boolean).join('');
    const loadStr = formatLoad(exercise, prMap);

    return (
        <View
            style={exStyles.row}
            accessible={!onEdit}
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
            {(onEdit || onDelete) && (
                <View style={exStyles.actions}>
                    {onEdit && (
                        <Pressable
                            style={exStyles.actionBtn}
                            onPress={onEdit}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel={`Modifica esercizio ${exercise.name}`}
                        >
                            <Ionicons name="pencil-outline" size={14} color="#007AFF" />
                        </Pressable>
                    )}
                    {onDelete && (
                        <Pressable
                            style={exStyles.actionBtn}
                            onPress={onDelete}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel={`Elimina esercizio ${exercise.name}`}
                        >
                            <Ionicons name="trash-outline" size={14} color="#FF3B30" />
                        </Pressable>
                    )}
                </View>
            )}
        </View>
    );
}

const exStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
    reps: { fontSize: 15, fontWeight: '700', minWidth: 48, textAlign: 'right', flexShrink: 0, lineHeight: 22 },
    bullet: { width: 48, alignItems: 'flex-end', paddingTop: 8, flexShrink: 0 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    info: { flex: 1 },
    name: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', lineHeight: 22 },
    load: { fontSize: 13, color: '#555', marginTop: 3 },
    exNotes: { fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 3 },
    actions: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingTop: 2, flexShrink: 0 },
    actionBtn: { padding: 5 },
});

// ── BlockCard ─────────────────────────────────────────────────────────────────

interface BlockCardProps {
    block: WorkoutBlock;
    canComplete: boolean;
    prMap: PrMap;
    onBlockToggle: (block: WorkoutBlock, completed: boolean) => Promise<void>;
    defaultExpanded?: boolean;
    onEditBlock?: () => void;
    onDeleteBlock?: () => void;
    onAddExercise?: () => void;
    onEditExercise?: (ex: WorkoutExercise) => void;
    onDeleteExercise?: (ex: WorkoutExercise) => void;
}

function BlockCard({
    block,
    canComplete,
    prMap,
    onBlockToggle,
    defaultExpanded = false,
    onEditBlock,
    onDeleteBlock,
    onAddExercise,
    onEditExercise,
    onDeleteExercise,
}: BlockCardProps): React.JSX.Element {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [isTogglingBlock, setIsTogglingBlock] = useState(false);

    const config = BLOCK_CONFIG[block.block_type];
    const exercises = [...block.workout_exercises].sort((a, b) => a.position - b.position);
    const allDone = isBlockComplete(block);
    const progress = blockProgress(block);
    const progressPct = Math.round(progress * 100);
    const showFormatPill =
        !!block.format &&
        !(block.title && isFormatRedundant(block.title, block.format));

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
                <View style={[bStyles.iconCircle, { backgroundColor: config.color + '18' }]}>
                    <Ionicons name={config.icon} size={20} color={config.color} />
                </View>

                <Pressable
                    style={bStyles.titleArea}
                    onPress={() => setExpanded((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={`${config.label}${showFormatPill ? ` · ${block.format}` : ''}. ${expanded ? 'Comprimi' : 'Espandi'}`}
                    accessibilityState={{ expanded }}
                >
                    {/* Tipologia + Modalità (stesso rigo) */}
                    <View style={bStyles.typeRow}>
                        <Text style={[bStyles.blockType, { color: config.color }]}>{config.label}</Text>
                        {showFormatPill && (
                            <View style={[bStyles.formatPill, { backgroundColor: config.color + '15', borderColor: config.color + '35' }]}>
                                <Text style={[bStyles.formatPillText, { color: config.color }]}>{block.format}</Text>
                            </View>
                        )}
                    </View>
                    {/* Titolo */}
                    {block.title && block.title !== config.label ? (
                        <Text style={bStyles.blockTitle} numberOfLines={1}>{block.title}</Text>
                    ) : null}
                </Pressable>

                <View style={bStyles.rightActions}>
                    {onEditBlock && (
                        <Pressable
                            onPress={onEditBlock}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={`Modifica blocco ${block.title || config.label}`}
                        >
                            <Ionicons name="pencil-outline" size={16} color="#007AFF" />
                        </Pressable>
                    )}
                    {onDeleteBlock && (
                        <Pressable
                            onPress={onDeleteBlock}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={`Elimina blocco ${block.title || config.label}`}
                        >
                            <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                        </Pressable>
                    )}
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

                    {block.description && exercises.length > 0 && (
                        <View style={bStyles.sectionDivider} />
                    )}

                    {exercises.length > 0 ? (
                        exercises.map((ex, idx) => (
                            <View key={ex.id}>
                                {idx > 0 && <View style={bStyles.divider} />}
                                <ExerciseRow
                                    exercise={ex}
                                    color={config.color}
                                    prMap={prMap}
                                    onEdit={onEditExercise ? () => onEditExercise(ex) : undefined}
                                    onDelete={onDeleteExercise ? () => onDeleteExercise(ex) : undefined}
                                />
                            </View>
                        ))
                    ) : (
                        <Text style={bStyles.emptyExercises}>Nessun esercizio</Text>
                    )}

                    {onAddExercise && (
                        <Pressable
                            style={[bStyles.addExBtn, { borderColor: config.color + '60' }]}
                            onPress={onAddExercise}
                            accessibilityRole="button"
                            accessibilityLabel="Aggiungi esercizio"
                        >
                            <Ionicons name="add-circle-outline" size={15} color={config.color} />
                            <Text style={[bStyles.addExBtnText, { color: config.color }]}>Aggiungi esercizio</Text>
                        </Pressable>
                    )}

                    {block.notes ? (
                        <View style={[bStyles.goalBox, { borderLeftColor: config.color, backgroundColor: config.color + '08' }]}>
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
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 8,
        elevation: 3,
    },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
    iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    titleArea: { flex: 1, gap: 4 },
    blockType: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
    blockTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
    rightActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
    blockCheck: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    blockCheckPct: { fontSize: 9, fontWeight: '800' },
    progressTrack: { height: 3, backgroundColor: '#f0f0f0' },
    progressFill: { height: 3 },
    body: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: 12 },
    description: { fontSize: 13, color: '#666', fontStyle: 'italic', lineHeight: 19, marginBottom: 14 },
    typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    formatPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    formatPillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
    divider: { height: 1, backgroundColor: '#ececec' },
    sectionDivider: { height: 1, backgroundColor: '#e0e0e8', marginBottom: 4 },
    emptyExercises: { fontSize: 14, color: '#aaa', paddingVertical: 10 },
    addExBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, marginTop: 4, borderWidth: 1, borderRadius: 8, justifyContent: 'center', borderStyle: 'dashed' },
    addExBtnText: { fontSize: 13, fontWeight: '600' },
    goalBox: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 3, marginTop: 16 },
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
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);

    // ── Edit session
    const [showEditSession, setShowEditSession] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [isSavingSession, setIsSavingSession] = useState(false);

    // ── Block modal
    type BlockModalMode = { mode: 'add' } | { mode: 'edit'; block: WorkoutBlock };
    const [blockModal, setBlockModal] = useState<BlockModalMode | null>(null);
    const [blockFormType, setBlockFormType] = useState<WorkoutBlock['block_type']>('work');
    const [blockFormTitle, setBlockFormTitle] = useState('');
    const [blockFormDesc, setBlockFormDesc] = useState('');
    const [blockFormFormat, setBlockFormFormat] = useState('');
    const [blockFormNotes, setBlockFormNotes] = useState('');
    const [isSavingBlock, setIsSavingBlock] = useState(false);
    const [blockFormError, setBlockFormError] = useState<string | null>(null);

    // ── Exercise modal
    type ExModalMode = { mode: 'add'; blockId: string } | { mode: 'edit'; exercise: WorkoutExercise; blockId: string };
    const [exModal, setExModal] = useState<ExModalMode | null>(null);
    const [exFormName, setExFormName] = useState('');
    const [exFormSets, setExFormSets] = useState('');
    const [exFormReps, setExFormReps] = useState('');
    const [exFormLoad, setExFormLoad] = useState('');
    const [exFormLoadNotes, setExFormLoadNotes] = useState('');
    const [exFormNotes, setExFormNotes] = useState('');
    const [isSavingEx, setIsSavingEx] = useState(false);
    const [exFormError, setExFormError] = useState<string | null>(null);

    const accessToken = session?.access_token;
    const userId = session?.user?.id ?? '';

    useLayoutEffect(() => {
        navigation.setOptions({
            title: workout?.title ?? 'Sessione',
            headerLeft: () => (
                <Pressable
                    onPress={() => {
                        const date = workout?.scheduled_date;
                        router.navigate({
                            pathname: '/(protected)/calendar' as RelativePathString,
                            params: date ? { date } : {},
                        });
                    }}
                    style={{ paddingLeft: 4, paddingRight: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Torna al calendario"
                    hitSlop={8}
                >
                    <Ionicons name="chevron-back" size={26} color="#007AFF" />
                </Pressable>
            ),
            headerRight: () => (
                <Pressable
                    onPress={() => setEditMode((v) => !v)}
                    style={{ paddingLeft: 12, paddingRight: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel={editMode ? 'Esci dalla modalità modifica' : 'Modifica sessione'}
                    hitSlop={8}
                >
                    <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: editMode ? '700' : '400' }}>
                        {editMode ? 'Fine' : 'Modifica'}
                    </Text>
                </Pressable>
            ),
        });
    }, [navigation, workout?.title, workout?.scheduled_date, editMode]);

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

    async function handleDeleteConfirm(): Promise<void> {
        if (!id) return;
        setIsDeleting(true);
        setDeleteError(null);
        try {
            await apiDelete(`/api/v1/workouts/${id}`, accessToken);
            router.back();
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : 'Impossibile eliminare la sessione.');
            setDeleteConfirm(false);
        } finally {
            setIsDeleting(false);
        }
    }

    // ── Edit session handlers ─────────────────────────────────────────────────

    function openEditSession(): void {
        if (!workout) return;
        setEditTitle(workout.title);
        setEditDate(workout.scheduled_date);
        setEditNotes(workout.notes ?? '');
        setShowEditSession(true);
    }

    async function handleSaveSession(): Promise<void> {
        if (!id || !workout) return;
        const title = editTitle.trim();
        if (!title) return;
        setIsSavingSession(true);
        try {
            await apiPatch(`/api/v1/workouts/${id}`, { title, scheduled_date: editDate, notes: editNotes || null }, accessToken);
            setWorkout((prev) => prev ? { ...prev, title, scheduled_date: editDate, notes: editNotes || undefined } : prev);
            setShowEditSession(false);
        } catch (err) {
            Alert.alert('Errore', err instanceof Error ? err.message : 'Impossibile salvare la sessione.');
        } finally {
            setIsSavingSession(false);
        }
    }

    // ── Block handlers ────────────────────────────────────────────────────────

    function openAddBlock(): void {
        setBlockFormType('work');
        setBlockFormTitle('');
        setBlockFormDesc('');
        setBlockFormFormat('');
        setBlockFormNotes('');
        setBlockFormError(null);
        setBlockModal({ mode: 'add' });
    }

    function openEditBlock(block: WorkoutBlock): void {
        setBlockFormType(block.block_type);
        setBlockFormTitle(block.title);
        setBlockFormDesc(block.description ?? '');
        setBlockFormFormat(block.format ?? '');
        setBlockFormNotes(block.notes ?? '');
        setBlockFormError(null);
        setBlockModal({ mode: 'edit', block });
    }

    async function handleSaveBlock(): Promise<void> {
        if (!blockModal) return;
        setIsSavingBlock(true);
        setBlockFormError(null);
        try {
            if (blockModal.mode === 'add') {
                const newBlock = await apiPost<WorkoutBlock>(
                    '/api/v1/blocks',
                    {
                        session_id: id,
                        block_type: blockFormType,
                        title: blockFormTitle.trim() || BLOCK_CONFIG[blockFormType].label,
                        description: blockFormDesc.trim() || null,
                        format: blockFormFormat.trim() || null,
                        notes: blockFormNotes.trim() || null,
                    },
                    {},
                    accessToken,
                );
                setWorkout((prev) => {
                    if (!prev) return prev;
                    const maxPos = prev.workout_blocks.reduce((m, b) => Math.max(m, b.position), 0);
                    return {
                        ...prev,
                        workout_blocks: [
                            ...prev.workout_blocks,
                            { ...newBlock, position: newBlock.position ?? maxPos + 1, workout_exercises: [] },
                        ],
                    };
                });
            } else {
                const { block } = blockModal;
                await apiPatch(
                    `/api/v1/blocks/${block.id}`,
                    {
                        block_type: blockFormType,
                        title: blockFormTitle.trim() || BLOCK_CONFIG[blockFormType].label,
                        description: blockFormDesc.trim() || null,
                        format: blockFormFormat.trim() || null,
                        notes: blockFormNotes.trim() || null,
                    },
                    accessToken,
                );
                setWorkout((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        workout_blocks: prev.workout_blocks.map((b) =>
                            b.id === block.id
                                ? {
                                    ...b,
                                    block_type: blockFormType,
                                    title: blockFormTitle.trim() || BLOCK_CONFIG[blockFormType].label,
                                    description: blockFormDesc.trim() || undefined,
                                    format: blockFormFormat.trim() || undefined,
                                    notes: blockFormNotes.trim() || undefined,
                                }
                                : b,
                        ),
                    };
                });
            }
            setBlockModal(null);
        } catch (err) {
            setBlockFormError(err instanceof Error ? err.message : 'Errore durante il salvataggio.');
        } finally {
            setIsSavingBlock(false);
        }
    }

    function handleDeleteBlock(block: WorkoutBlock): void {
        Alert.alert(
            'Elimina blocco',
            `Eliminare il blocco "${block.title || BLOCK_CONFIG[block.block_type].label}"? Tutti gli esercizi verranno eliminati.`,
            [
                { text: 'Annulla', style: 'cancel' },
                {
                    text: 'Elimina',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiDelete(`/api/v1/blocks/${block.id}`, accessToken);
                            setWorkout((prev) =>
                                prev
                                    ? { ...prev, workout_blocks: prev.workout_blocks.filter((b) => b.id !== block.id) }
                                    : prev,
                            );
                        } catch (err) {
                            Alert.alert('Errore', err instanceof Error ? err.message : 'Impossibile eliminare il blocco.');
                        }
                    },
                },
            ],
        );
    }

    // ── Exercise handlers ─────────────────────────────────────────────────────

    function openAddExercise(blockId: string): void {
        setExFormName('');
        setExFormSets('');
        setExFormReps('');
        setExFormLoad('');
        setExFormLoadNotes('');
        setExFormNotes('');
        setExFormError(null);
        setExModal({ mode: 'add', blockId });
    }

    function openEditExercise(ex: WorkoutExercise, blockId: string): void {
        setExFormName(ex.name);
        setExFormSets(ex.sets ? String(ex.sets) : '');
        setExFormReps(ex.reps ?? '');
        setExFormLoad(ex.load_kg ? String(ex.load_kg) : '');
        setExFormLoadNotes(ex.load_notes ?? '');
        setExFormNotes(ex.ex_notes ?? '');
        setExFormError(null);
        setExModal({ mode: 'edit', exercise: ex, blockId });
    }

    async function handleSaveExercise(): Promise<void> {
        if (!exModal) return;
        const name = exFormName.trim();
        if (!name) { setExFormError('Inserisci il nome dell\'esercizio.'); return; }
        const loadKg = exFormLoad ? parseFloat(exFormLoad.replace(',', '.')) : undefined;
        if (exFormLoad && (isNaN(loadKg!) || loadKg! <= 0)) { setExFormError('Carico non valido.'); return; }
        setExFormError(null);
        setIsSavingEx(true);
        try {
            const body = {
                name,
                sets: exFormSets ? parseInt(exFormSets, 10) : null,
                reps: exFormReps.trim() || null,
                load_kg: loadKg ?? null,
                load_notes: exFormLoadNotes.trim() || null,
                ex_notes: exFormNotes.trim() || null,
            };
            if (exModal.mode === 'add') {
                const newEx = await apiPost<WorkoutExercise>(
                    '/api/v1/exercises',
                    { ...body, block_id: exModal.blockId },
                    {},
                    accessToken,
                );
                setWorkout((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        workout_blocks: prev.workout_blocks.map((b) =>
                            b.id === exModal.blockId
                                ? {
                                    ...b,
                                    workout_exercises: [
                                        ...b.workout_exercises,
                                        { ...newEx, position: newEx.position ?? b.workout_exercises.length + 1, completed: false, ex_notes: newEx.ex_notes ?? '' },
                                    ],
                                }
                                : b,
                        ),
                    };
                });
            } else {
                const { exercise: ex } = exModal;
                await apiPatch(`/api/v1/exercises/${ex.id}`, body, accessToken);
                setWorkout((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        workout_blocks: prev.workout_blocks.map((b) =>
                            b.id === exModal.blockId
                                ? {
                                    ...b,
                                    workout_exercises: b.workout_exercises.map((e) =>
                                        e.id === ex.id
                                            ? { ...e, ...body, sets: body.sets ?? undefined, reps: body.reps ?? undefined, load_kg: body.load_kg ?? undefined, load_notes: body.load_notes ?? undefined, ex_notes: body.ex_notes ?? '' }
                                            : e,
                                    ),
                                }
                                : b,
                        ),
                    };
                });
            }
            setExModal(null);
        } catch (err) {
            setExFormError(err instanceof Error ? err.message : 'Errore durante il salvataggio.');
        } finally {
            setIsSavingEx(false);
        }
    }

    function handleDeleteExercise(ex: WorkoutExercise, blockId: string): void {
        Alert.alert(
            'Elimina esercizio',
            `Eliminare "${ex.name}"?`,
            [
                { text: 'Annulla', style: 'cancel' },
                {
                    text: 'Elimina',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiDelete(`/api/v1/exercises/${ex.id}`, accessToken);
                            setWorkout((prev) => {
                                if (!prev) return prev;
                                return {
                                    ...prev,
                                    workout_blocks: prev.workout_blocks.map((b) =>
                                        b.id === blockId
                                            ? { ...b, workout_exercises: b.workout_exercises.filter((e) => e.id !== ex.id) }
                                            : b,
                                    ),
                                };
                            });
                        } catch (err) {
                            Alert.alert('Errore', err instanceof Error ? err.message : 'Impossibile eliminare l\'esercizio.');
                        }
                    },
                },
            ],
        );
    }

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#007AFF" accessibilityLabel="Caricamento sessione" />
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
    const totalBlocks = sortedBlocks.length;
    const completedBlocks = sortedBlocks.filter((b) => isBlockComplete(b)).length;
    const totalEx = sortedBlocks.reduce((s, b) => s + b.workout_exercises.length, 0);
    const canComplete = workout.status === 'planned';
    const statusColor = STATUS_COLORS[workout.status] ?? '#999';
    const overviewPct = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Info card: date, status, notes */}
            <View style={styles.infoCard}>
                <View style={styles.infoCardHeader}>
                    <Text style={styles.dateText}>{formatDateIT(workout.scheduled_date)}</Text>
                    {editMode && (
                        <Pressable
                            onPress={openEditSession}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Modifica sessione"
                        >
                            <Ionicons name="pencil-outline" size={16} color="#007AFF" />
                        </Pressable>
                    )}
                </View>
                <View style={styles.metaRow}>
                    <View style={[styles.statusPill, { backgroundColor: statusColor + '1A' }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusPillText, { color: statusColor }]}>
                            {STATUS_LABELS[workout.status] ?? workout.status}
                        </Text>
                    </View>
                    {totalEx > 0 && (
                        <View style={styles.metaChip}>
                            <Ionicons name="barbell-outline" size={12} color="#666" />
                            <Text style={styles.metaChipText}>{sortedBlocks.length} blocchi · {totalEx} esercizi</Text>
                        </View>
                    )}
                </View>
                {workout.notes ? <Text style={styles.notesText}>{workout.notes}</Text> : null}
            </View>

            {/* Overall progress bar */}
            {totalBlocks > 0 && canComplete && (
                <View style={styles.overviewBar}>
                    <View style={styles.overviewLeft}>
                        <Ionicons name="checkmark-circle-outline" size={16} color="#007AFF" />
                        <Text style={styles.overviewText}>{completedBlocks}/{totalBlocks} blocchi completati</Text>
                    </View>
                    <View style={styles.overviewTrack}>
                        <View style={[styles.overviewFill, { width: `${overviewPct}%` as `${number}%` }]} />
                    </View>
                    <Text style={styles.overviewPct}>{overviewPct}%</Text>
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
                        onEditBlock={editMode ? () => openEditBlock(block) : undefined}
                        onDeleteBlock={editMode ? () => handleDeleteBlock(block) : undefined}
                        onAddExercise={editMode ? () => openAddExercise(block.id) : undefined}
                        onEditExercise={editMode ? (ex) => openEditExercise(ex, block.id) : undefined}
                        onDeleteExercise={editMode ? (ex) => handleDeleteExercise(ex, block.id) : undefined}
                    />
                ))
            ) : (
                <View style={styles.emptyCard}>
                    <Ionicons name="barbell-outline" size={40} color="#ccc" />
                    <Text style={styles.emptyText}>Nessun blocco — tocca + per aggiungerne uno.</Text>
                </View>
            )}

            {/* Add block button — solo in edit mode */}
            {editMode && (
                <Pressable
                    style={styles.addBlockBtn}
                    onPress={openAddBlock}
                    accessibilityRole="button"
                    accessibilityLabel="Aggiungi blocco"
                >
                    <Ionicons name="add-circle-outline" size={18} color="#007AFF" />
                    <Text style={styles.addBlockBtnText}>Aggiungi blocco</Text>
                </Pressable>
            )}

            {/* Post-workout log */}
            {workout.status === 'completed' && (
                <View style={styles.postCard}>
                    <View style={styles.postHeader}>
                        <Ionicons name="trophy" size={16} color="#FF9500" />
                        <Text style={styles.postTitle}>Post-workout log</Text>
                    </View>
                    <View style={styles.statsRow}>
                        {workout.rpe ? (
                            <View style={styles.statItem}>
                                <Text style={styles.statVal}>{workout.rpe}<Text style={styles.statUnit}>/10</Text></Text>
                                <Text style={styles.statLbl}>RPE</Text>
                            </View>
                        ) : null}
                        {totalBlocks > 0 && (
                            <View style={styles.statItem}>
                                <Text style={styles.statVal}>{completedBlocks}<Text style={styles.statUnit}>/{totalBlocks}</Text></Text>
                                <Text style={styles.statLbl}>Blocchi</Text>
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

            {/* Delete — solo in edit mode */}
            {editMode && (
            <>
            {deleteError ? (
                <Text style={styles.deleteErrorText} accessibilityRole="alert">{deleteError}</Text>
            ) : null}
            {deleteConfirm ? (
                <View style={styles.deleteConfirmRow}>
                    <Text style={styles.deleteConfirmText}>Eliminare questa sessione?</Text>
                    <View style={styles.deleteConfirmButtons}>
                        <Pressable
                            style={styles.deleteCancelBtn}
                            onPress={() => setDeleteConfirm(false)}
                            accessibilityRole="button"
                            accessibilityLabel="Annulla eliminazione"
                        >
                            <Text style={styles.deleteCancelBtnText}>Annulla</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.deleteConfirmBtn, isDeleting && styles.deleteButtonDisabled]}
                            onPress={handleDeleteConfirm}
                            disabled={isDeleting}
                            accessibilityRole="button"
                            accessibilityLabel="Conferma eliminazione"
                            accessibilityState={{ disabled: isDeleting }}
                        >
                            {isDeleting ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.deleteConfirmBtnText}>Sì, elimina</Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            ) : (
                <Pressable
                    style={styles.deleteButton}
                    onPress={() => { setDeleteConfirm(true); setDeleteError(null); }}
                    accessibilityRole="button"
                    accessibilityLabel="Elimina questa sessione"
                >
                    <Text style={styles.deleteButtonText}>Elimina sessione</Text>
                </Pressable>
            )}
            </>
            )}

            {/* ── Complete modal ── */}
            <Modal
                visible={showCompleteModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCompleteModal(false)}
                accessibilityViewIsModal
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent} aria-modal aria-labelledby="modal-title">
                        <Text nativeID="modal-title" style={styles.modalTitle} accessibilityRole="header">Post-workout log</Text>
                        <Text style={styles.modalSubtitle}>Quanto è stata intensa questa sessione?</Text>

                        <Text style={styles.rpeLabel}>RPE (1–10)</Text>
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

                        <Text style={styles.disclaimer}>⚠️ Consulta un professionista per qualsiasi preoccupazione sanitaria.</Text>

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

            {/* ── Edit session modal ── */}
            <Modal
                visible={showEditSession}
                transparent
                animationType="slide"
                onRequestClose={() => setShowEditSession(false)}
                accessibilityViewIsModal
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent} aria-modal aria-labelledby="edit-session-title">
                        <View style={styles.modalHeader}>
                            <Text nativeID="edit-session-title" style={styles.modalTitle} accessibilityRole="header">Modifica sessione</Text>
                            <Pressable onPress={() => setShowEditSession(false)} accessibilityRole="button" accessibilityLabel="Chiudi">
                                <Ionicons name="close" size={22} color="#999" />
                            </Pressable>
                        </View>

                        <Text style={styles.inputLabel}>Titolo</Text>
                        <TextInput
                            style={styles.textInput}
                            value={editTitle}
                            onChangeText={setEditTitle}
                            placeholder="Titolo sessione"
                            accessibilityLabel="Titolo sessione"
                        />

                        <Text style={styles.inputLabel}>Data (YYYY-MM-DD)</Text>
                        <TextInput
                            style={styles.textInput}
                            value={editDate}
                            onChangeText={setEditDate}
                            placeholder="2025-01-15"
                            keyboardType="numbers-and-punctuation"
                            accessibilityLabel="Data sessione"
                        />

                        <Text style={styles.inputLabel}>Note</Text>
                        <TextInput
                            style={[styles.textInput, styles.textInputMulti]}
                            value={editNotes}
                            onChangeText={setEditNotes}
                            placeholder="Note della sessione"
                            multiline
                            numberOfLines={3}
                            accessibilityLabel="Note sessione"
                        />

                        <View style={styles.modalButtons}>
                            <Pressable style={styles.cancelButton} onPress={() => setShowEditSession(false)} accessibilityRole="button" accessibilityLabel="Annulla">
                                <Text style={styles.cancelButtonText}>Annulla</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.confirmButton, isSavingSession && styles.confirmButtonDisabled]}
                                onPress={handleSaveSession}
                                disabled={isSavingSession}
                                accessibilityRole="button"
                                accessibilityLabel="Salva sessione"
                                accessibilityState={{ disabled: isSavingSession }}
                            >
                                {isSavingSession ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmButtonText}>Salva</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Block modal ── */}
            <Modal
                visible={blockModal !== null}
                transparent
                animationType="slide"
                onRequestClose={() => setBlockModal(null)}
                accessibilityViewIsModal
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent} aria-modal aria-labelledby="block-modal-title">
                        <View style={styles.modalHeader}>
                            <Text nativeID="block-modal-title" style={styles.modalTitle} accessibilityRole="header">
                                {blockModal?.mode === 'add' ? 'Nuovo blocco' : 'Modifica blocco'}
                            </Text>
                            <Pressable onPress={() => setBlockModal(null)} accessibilityRole="button" accessibilityLabel="Chiudi">
                                <Ionicons name="close" size={22} color="#999" />
                            </Pressable>
                        </View>

                        <Text style={styles.inputLabel}>Tipo</Text>
                        <View style={styles.typeSelector}>
                            {(Object.entries(BLOCK_CONFIG) as [WorkoutBlock['block_type'], BlockConfig][]).map(([t, cfg]) => (
                                <Pressable
                                    key={t}
                                    style={[styles.typeBtn, blockFormType === t && { borderColor: cfg.color, backgroundColor: cfg.color + '15' }]}
                                    onPress={() => setBlockFormType(t)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: blockFormType === t }}
                                    accessibilityLabel={cfg.label}
                                >
                                    <Ionicons name={cfg.icon} size={14} color={blockFormType === t ? cfg.color : '#999'} />
                                    <Text style={[styles.typeBtnText, blockFormType === t && { color: cfg.color }]}>{cfg.label}</Text>
                                </Pressable>
                            ))}
                        </View>

                        <Text style={styles.inputLabel}>Titolo</Text>
                        <TextInput
                            style={styles.textInput}
                            value={blockFormTitle}
                            onChangeText={setBlockFormTitle}
                            placeholder={BLOCK_CONFIG[blockFormType].label}
                            accessibilityLabel="Titolo blocco"
                        />

                        <Text style={styles.inputLabel}>Formato (es. AMRAP, EMOM)</Text>
                        <TextInput
                            style={styles.textInput}
                            value={blockFormFormat}
                            onChangeText={setBlockFormFormat}
                            placeholder="opzionale"
                            accessibilityLabel="Formato blocco"
                        />

                        <Text style={styles.inputLabel}>Descrizione</Text>
                        <TextInput
                            style={[styles.textInput, styles.textInputMulti]}
                            value={blockFormDesc}
                            onChangeText={setBlockFormDesc}
                            placeholder="opzionale"
                            multiline
                            numberOfLines={2}
                            accessibilityLabel="Descrizione blocco"
                        />

                        <Text style={styles.inputLabel}>Goal</Text>
                        <TextInput
                            style={styles.textInput}
                            value={blockFormNotes}
                            onChangeText={setBlockFormNotes}
                            placeholder="opzionale"
                            accessibilityLabel="Goal blocco"
                        />

                        {blockFormError ? <Text style={styles.formError} accessibilityRole="alert">{blockFormError}</Text> : null}

                        <View style={styles.modalButtons}>
                            <Pressable style={styles.cancelButton} onPress={() => setBlockModal(null)} accessibilityRole="button" accessibilityLabel="Annulla">
                                <Text style={styles.cancelButtonText}>Annulla</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.confirmButton, isSavingBlock && styles.confirmButtonDisabled]}
                                onPress={handleSaveBlock}
                                disabled={isSavingBlock}
                                accessibilityRole="button"
                                accessibilityLabel="Salva blocco"
                                accessibilityState={{ disabled: isSavingBlock }}
                            >
                                {isSavingBlock ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmButtonText}>Salva</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Exercise modal ── */}
            <Modal
                visible={exModal !== null}
                transparent
                animationType="slide"
                onRequestClose={() => setExModal(null)}
                accessibilityViewIsModal
            >
                <View style={styles.modalOverlay}>
                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
                        <View style={styles.modalContent} aria-modal aria-labelledby="ex-modal-title">
                            <View style={styles.modalHeader}>
                                <Text nativeID="ex-modal-title" style={styles.modalTitle} accessibilityRole="header">
                                    {exModal?.mode === 'add' ? 'Nuovo esercizio' : 'Modifica esercizio'}
                                </Text>
                                <Pressable onPress={() => setExModal(null)} accessibilityRole="button" accessibilityLabel="Chiudi">
                                    <Ionicons name="close" size={22} color="#999" />
                                </Pressable>
                            </View>

                            <Text style={styles.inputLabel}>Nome *</Text>
                            <TextInput
                                style={styles.textInput}
                                value={exFormName}
                                onChangeText={setExFormName}
                                placeholder="es. Back Squat"
                                autoFocus
                                accessibilityLabel="Nome esercizio"
                            />

                            <View style={styles.twoCol}>
                                <View style={styles.twoColItem}>
                                    <Text style={styles.inputLabel}>Serie</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={exFormSets}
                                        onChangeText={setExFormSets}
                                        placeholder="es. 4"
                                        keyboardType="number-pad"
                                        accessibilityLabel="Numero serie"
                                    />
                                </View>
                                <View style={styles.twoColItem}>
                                    <Text style={styles.inputLabel}>Reps / Tempo</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={exFormReps}
                                        onChangeText={setExFormReps}
                                        placeholder="es. 5 o 30s"
                                        accessibilityLabel="Ripetizioni o tempo"
                                    />
                                </View>
                            </View>

                            <View style={styles.twoCol}>
                                <View style={styles.twoColItem}>
                                    <Text style={styles.inputLabel}>Carico (kg)</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={exFormLoad}
                                        onChangeText={setExFormLoad}
                                        placeholder="es. 80"
                                        keyboardType="decimal-pad"
                                        accessibilityLabel="Carico in kg"
                                    />
                                </View>
                                <View style={styles.twoColItem}>
                                    <Text style={styles.inputLabel}>Note carico</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={exFormLoadNotes}
                                        onChangeText={setExFormLoadNotes}
                                        placeholder="es. 75%"
                                        accessibilityLabel="Note carico"
                                    />
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Note esercizio</Text>
                            <TextInput
                                style={[styles.textInput, styles.textInputMulti]}
                                value={exFormNotes}
                                onChangeText={setExFormNotes}
                                placeholder="opzionale"
                                multiline
                                numberOfLines={2}
                                accessibilityLabel="Note esercizio"
                            />

                            {exFormError ? <Text style={styles.formError} accessibilityRole="alert">{exFormError}</Text> : null}

                            <View style={styles.modalButtons}>
                                <Pressable style={styles.cancelButton} onPress={() => setExModal(null)} accessibilityRole="button" accessibilityLabel="Annulla">
                                    <Text style={styles.cancelButtonText}>Annulla</Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.confirmButton, isSavingEx && styles.confirmButtonDisabled]}
                                    onPress={handleSaveExercise}
                                    disabled={isSavingEx}
                                    accessibilityRole="button"
                                    accessibilityLabel="Salva esercizio"
                                    accessibilityState={{ disabled: isSavingEx }}
                                >
                                    {isSavingEx ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmButtonText}>Salva</Text>}
                                </Pressable>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        </ScrollView>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f0f5' },
    content: { padding: 16, paddingBottom: 48, gap: 16 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f5f5f5' },
    errorText: { color: '#FF3B30', fontSize: 16, textAlign: 'center', marginBottom: 16 },
    backButton: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#007AFF', borderRadius: 8 },
    backButtonText: { color: '#fff', fontWeight: '600' },
    // Info card
    infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
    infoCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dateText: { fontSize: 13, color: '#999', fontWeight: '500' },
    metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusPillText: { fontSize: 12, fontWeight: '700' },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0f0f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    metaChipText: { fontSize: 12, color: '#666', fontWeight: '500' },
    notesText: { fontSize: 13, color: '#666', fontStyle: 'italic', lineHeight: 18 },
    // Overview bar
    overviewBar: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
    overviewLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    overviewText: { fontSize: 13, color: '#555', fontWeight: '500' },
    overviewTrack: { flex: 1, height: 4, backgroundColor: '#eee', borderRadius: 2, overflow: 'hidden' },
    overviewFill: { height: 4, backgroundColor: '#007AFF', borderRadius: 2 },
    overviewPct: { fontSize: 12, color: '#007AFF', fontWeight: '700', minWidth: 32, textAlign: 'right' },
    // Empty
    emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', gap: 12 },
    emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center' },
    // Post-workout
    postCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
    postHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    postTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
    statsRow: { flexDirection: 'row', gap: 24 },
    statItem: { alignItems: 'center' },
    statVal: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
    statUnit: { fontSize: 14, fontWeight: '500', color: '#aaa' },
    statLbl: { fontSize: 11, color: '#aaa', textTransform: 'uppercase', marginTop: 2, letterSpacing: 0.4 },
    feedbackText: { fontSize: 14, color: '#555', fontStyle: 'italic' },
    // Add block
    addBlockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#007AFF', borderStyle: 'dashed' },
    addBlockBtnText: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
    // Modal shared
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    inputLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 4, marginTop: 10 },
    textInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1a1a1a', backgroundColor: '#fafafa' },
    textInputMulti: { textAlignVertical: 'top', minHeight: 70 },
    formError: { fontSize: 13, color: '#d00', marginTop: 8 },
    typeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fafafa' },
    typeBtnText: { fontSize: 11, fontWeight: '700', color: '#999' },
    twoCol: { flexDirection: 'row', gap: 10 },
    twoColItem: { flex: 1 },
    modalScroll: { maxHeight: '90%' },
    modalScrollContent: { justifyContent: 'flex-end' },
    // Primary CTA
    primaryButton: { backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
    // Delete
    deleteButton: { borderWidth: 1.5, borderColor: '#FF3B30', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    deleteButtonDisabled: { opacity: 0.5 },
    deleteButtonText: { color: '#FF3B30', fontSize: 14, fontWeight: '600' },
    deleteErrorText: { color: '#FF3B30', fontSize: 13, textAlign: 'center' },
    deleteConfirmRow: { borderWidth: 1.5, borderColor: '#FF3B30', borderRadius: 12, padding: 14, gap: 12 },
    deleteConfirmText: { fontSize: 14, fontWeight: '600', color: '#FF3B30', textAlign: 'center' },
    deleteConfirmButtons: { flexDirection: 'row', gap: 10 },
    deleteCancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e5e5', alignItems: 'center' },
    deleteCancelBtnText: { fontSize: 14, fontWeight: '600', color: '#666' },
    deleteConfirmBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#FF3B30', alignItems: 'center' },
    deleteConfirmBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
    modalSubtitle: { fontSize: 14, color: '#666' },
    rpeLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
    rpeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    rpeButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
    rpeButtonSelected: { backgroundColor: '#007AFF' },
    rpeButtonText: { fontSize: 14, fontWeight: '600', color: '#007AFF' },
    rpeButtonTextSelected: { color: '#fff' },
    feedbackLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
    feedbackInput: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 10, padding: 12, fontSize: 14, color: '#1a1a1a', textAlignVertical: 'top', minHeight: 80 },
    disclaimer: { fontSize: 11, color: '#aaa', fontStyle: 'italic' },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
    cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e5e5', alignItems: 'center' },
    cancelButtonText: { fontSize: 15, fontWeight: '600', color: '#666' },
    confirmButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#007AFF', alignItems: 'center' },
    confirmButtonDisabled: { opacity: 0.6 },
    confirmButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
