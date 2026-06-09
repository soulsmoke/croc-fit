/**
 * Personal Records screen — list PRs, calculate training loads.
 * Full manual CRUD: add, edit and delete PRs without the AI agent.
 * Implements REQ-012 (PR register), REQ-013 (load %), REQ-014 (rounded output), REQ-025 (disclaimer).
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';

interface PR {
    id: string;
    exercise_name: string;
    weight_kg: number;
    unit: string;
    recorded_at: string;
}

interface LoadTable {
    exercise_name: string;
    pr_weight_kg: number;
    unit: string;
    disclaimer: string;
    loads: { percentage: number; weight: number; rounded: number }[];
}

const LOAD_PERCENTAGES = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildLocalLoads(pr: PR): LoadTable {
    return {
        exercise_name: pr.exercise_name,
        pr_weight_kg: pr.weight_kg,
        unit: pr.unit,
        disclaimer: '⚠️ Training guidance only. Consult a professional for health concerns.',
        loads: LOAD_PERCENTAGES.map((p) => {
            const raw = (pr.weight_kg * p) / 100;
            const rounded = Math.round(raw / 2.5) * 2.5;
            return { percentage: p, weight: raw, rounded };
        }),
    };
}

export default function PRsScreen(): React.JSX.Element {
    const { session } = useAuth();
    const [prs, setPRs] = useState<PR[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load calculator
    const [selectedPR, setSelectedPR] = useState<PR | null>(null);
    const [loadTable, setLoadTable] = useState<LoadTable | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [calcError, setCalcError] = useState<string | null>(null);

    // Add / edit form
    const [editTarget, setEditTarget] = useState<PR | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState('');
    const [formWeight, setFormWeight] = useState('');
    const [formUnit, setFormUnit] = useState('kg');
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const userId = session?.user?.id ?? '';
    const accessToken = session?.access_token;

    function fetchPRs(): void {
        if (!userId) return;
        apiGet<PR[]>('/api/v1/prs', { user_id: userId }, accessToken)
            .then(setPRs)
            .catch((err: Error) => setError(err.message))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        fetchPRs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // ── Load calculator ───────────────────────────────────────────────────────

    function openCalculator(pr: PR): void {
        setSelectedPR(pr);
        setLoadTable(null);
        setCalcError(null);
        setIsCalculating(true);
        apiPost<LoadTable>(
            '/api/v1/loads/calculate',
            { exercise_name: pr.exercise_name, round_to_kg: 2.5 },
            { user_id: userId },
            accessToken,
        )
            .then(setLoadTable)
            .catch((err: Error) => setCalcError(err.message))
            .finally(() => setIsCalculating(false));
    }

    // ── Add / Edit ────────────────────────────────────────────────────────────

    function openAddForm(): void {
        setEditTarget(null);
        setFormName('');
        setFormWeight('');
        setFormUnit('kg');
        setFormError(null);
        setShowForm(true);
    }

    function openEditForm(pr: PR): void {
        setEditTarget(pr);
        setFormName(pr.exercise_name);
        setFormWeight(String(pr.weight_kg));
        setFormUnit(pr.unit);
        setFormError(null);
        setShowForm(true);
    }

    async function handleSave(): Promise<void> {
        const name = formName.trim();
        const weight = parseFloat(formWeight.replace(',', '.'));
        if (!name) { setFormError("Inserisci il nome dell'esercizio."); return; }
        if (isNaN(weight) || weight <= 0) { setFormError('Inserisci un peso valido.'); return; }
        setFormError(null);
        setIsSaving(true);
        try {
            if (editTarget) {
                await apiPatch(`/api/v1/prs/${editTarget.id}`, { weight_kg: weight, unit: formUnit }, accessToken);
            } else {
                await apiPost('/api/v1/prs', { exercise_name: name, weight_kg: weight, unit: formUnit }, { user_id: userId }, accessToken);
            }
            setShowForm(false);
            fetchPRs();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Errore durante il salvataggio.');
        } finally {
            setIsSaving(false);
        }
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    function handleDelete(pr: PR): void {
        Alert.alert(
            'Elimina PR',
            `Eliminare il PR di ${pr.exercise_name} (${pr.weight_kg} ${pr.unit})?`,
            [
                { text: 'Annulla', style: 'cancel' },
                {
                    text: 'Elimina',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiDelete(`/api/v1/prs/${pr.id}`, accessToken);
                            setPRs((prev) => prev.filter((p) => p.id !== pr.id));
                        } catch (err) {
                            Alert.alert('Errore', err instanceof Error ? err.message : 'Impossibile eliminare il PR.');
                        }
                    },
                },
            ],
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────

    const renderPR = ({ item }: { item: PR }): React.JSX.Element => (
        <View style={styles.prCard}>
            <Pressable
                style={styles.prCardMain}
                onPress={() => openCalculator(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.exercise_name}: ${item.weight_kg} ${item.unit}. Tocca per calcolare i carichi.`}
            >
                <Text style={styles.exerciseName} numberOfLines={2}>{item.exercise_name}</Text>
                <View style={styles.weightRow}>
                    <Text style={styles.weightValue}>{item.weight_kg}</Text>
                    <Text style={styles.weightUnit}>{item.unit}</Text>
                </View>
                <Text style={styles.recordedAt}>{new Date(item.recorded_at).toLocaleDateString('it-IT')}</Text>
                <Text style={styles.calcHint}>📊 Carichi</Text>
            </Pressable>
            <View style={styles.prActions}>
                <Pressable
                    style={styles.prActionBtn}
                    onPress={() => openEditForm(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Modifica PR ${item.exercise_name}`}
                    hitSlop={6}
                >
                    <Ionicons name="pencil-outline" size={15} color="#007AFF" />
                </Pressable>
                <Pressable
                    style={[styles.prActionBtn, styles.prActionBtnDelete]}
                    onPress={() => handleDelete(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Elimina PR ${item.exercise_name}`}
                    hitSlop={6}
                >
                    <Ionicons name="trash-outline" size={15} color="#FF3B30" />
                </Pressable>
            </View>
        </View>
    );

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#007AFF" accessibilityLabel="Caricamento PR" />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
            </View>
        );
    }

    const inner = (
        <View style={styles.container}>
            {prs.length === 0 ? (
                <View style={styles.centered}>
                    <Ionicons name="trophy-outline" size={48} color="#d0d0d0" />
                    <Text style={styles.emptyText}>{'Nessun PR registrato.\nTocca + per aggiungerne uno.'}</Text>
                </View>
            ) : (
                <FlatList
                    data={prs}
                    keyExtractor={(p) => p.id}
                    renderItem={renderPR}
                    numColumns={2}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={styles.list}
                    accessibilityRole="list"
                    accessibilityLabel="Personal record"
                />
            )}

            {/* FAB */}
            <Pressable
                style={styles.fab}
                onPress={openAddForm}
                accessibilityRole="button"
                accessibilityLabel="Aggiungi nuovo PR"
            >
                <Ionicons name="add" size={28} color="#fff" />
            </Pressable>
        </View>
    );

    const calcTable = loadTable ?? (calcError && selectedPR ? buildLocalLoads(selectedPR) : null);

    return (
        <>
            {inner}

            {/* ── Load calculator modal ── */}
            <Modal
                visible={selectedPR !== null}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedPR(null)}
                accessibilityViewIsModal
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent} aria-modal aria-labelledby="load-modal-title">
                        <View style={styles.modalHeader}>
                            <Text nativeID="load-modal-title" style={styles.modalTitle} accessibilityRole="header">
                                {selectedPR?.exercise_name}
                            </Text>
                            <Pressable
                                onPress={() => setSelectedPR(null)}
                                accessibilityRole="button"
                                accessibilityLabel="Chiudi calcolatore"
                            >
                                <Ionicons name="close" size={22} color="#999" />
                            </Pressable>
                        </View>

                        {isCalculating ? (
                            <ActivityIndicator
                                size="large"
                                color="#007AFF"
                                accessibilityLabel="Calculating loads"
                            />
                        ) : calcTable ? (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text style={styles.prRef}>
                                    PR: {calcTable.pr_weight_kg} {calcTable.unit}
                                </Text>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.tableCell, styles.tableCellHeader]}>%</Text>
                                    <Text style={[styles.tableCell, styles.tableCellHeader]}>Esatto</Text>
                                    <Text style={[styles.tableCell, styles.tableCellHeader]}>Arrotondato</Text>
                                </View>
                                {calcTable.loads.map((row) => (
                                    <View
                                        key={row.percentage}
                                        style={[styles.tableRow, row.percentage === 100 && styles.tableRowPR]}
                                        accessibilityRole="none"
                                        accessibilityLabel={`${row.percentage}% — ${row.rounded} ${calcTable.unit}`}
                                    >
                                        <Text style={[styles.tableCell, styles.tablePct]}>{row.percentage}%</Text>
                                        <Text style={styles.tableCell}>{row.weight.toFixed(1)}</Text>
                                        <Text style={[styles.tableCell, styles.tableRounded]}>{row.rounded}</Text>
                                    </View>
                                ))}
                                <Text style={styles.disclaimer}>{calcTable.disclaimer}</Text>
                            </ScrollView>
                        ) : (
                            <Text style={styles.errorText} accessibilityRole="alert">
                                {calcError ?? 'Impossibile caricare la tabella'}
                            </Text>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ── Add / Edit PR modal ── */}
            <Modal
                visible={showForm}
                transparent
                animationType="slide"
                onRequestClose={() => setShowForm(false)}
                accessibilityViewIsModal
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent} aria-modal aria-labelledby="pr-form-title">
                        <View style={styles.modalHeader}>
                            <Text nativeID="pr-form-title" style={styles.modalTitle} accessibilityRole="header">
                                {editTarget ? 'Modifica PR' : 'Nuovo PR'}
                            </Text>
                            <Pressable onPress={() => setShowForm(false)} accessibilityRole="button" accessibilityLabel="Chiudi">
                                <Ionicons name="close" size={22} color="#999" />
                            </Pressable>
                        </View>

                        <Text style={styles.inputLabel}>Esercizio *</Text>
                        <TextInput
                            style={[styles.input, !!editTarget && styles.inputDisabled]}
                            value={formName}
                            onChangeText={setFormName}
                            placeholder="es. Back Squat"
                            editable={!editTarget}
                            autoFocus={!editTarget}
                            accessibilityLabel="Nome esercizio"
                        />

                        <Text style={styles.inputLabel}>Peso *</Text>
                        <TextInput
                            style={styles.input}
                            value={formWeight}
                            onChangeText={setFormWeight}
                            placeholder="es. 120"
                            keyboardType="decimal-pad"
                            autoFocus={!!editTarget}
                            accessibilityLabel="Peso"
                        />

                        <Text style={styles.inputLabel}>Unità</Text>
                        <View style={styles.unitRow}>
                            {(['kg', 'lb'] as const).map((u) => (
                                <Pressable
                                    key={u}
                                    style={[styles.unitBtn, formUnit === u && styles.unitBtnSelected]}
                                    onPress={() => setFormUnit(u)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: formUnit === u }}
                                    accessibilityLabel={u}
                                >
                                    <Text style={[styles.unitBtnText, formUnit === u && styles.unitBtnTextSelected]}>{u}</Text>
                                </Pressable>
                            ))}
                        </View>

                        {formError ? <Text style={styles.formError} accessibilityRole="alert">{formError}</Text> : null}

                        <View style={styles.modalButtons}>
                            <Pressable style={styles.cancelButton} onPress={() => setShowForm(false)} accessibilityRole="button" accessibilityLabel="Annulla">
                                <Text style={styles.cancelButtonText}>Annulla</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.confirmButton, isSaving && styles.confirmButtonDisabled]}
                                onPress={handleSave}
                                disabled={isSaving}
                                accessibilityRole="button"
                                accessibilityLabel="Salva PR"
                                accessibilityState={{ disabled: isSaving }}
                            >
                                {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmButtonText}>Salva</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
    list: { padding: 16, gap: 10 },
    row: { gap: 10, marginBottom: 0 },

    prCard: {
        flex: 1,
        borderRadius: 14,
        backgroundColor: '#fff',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 2,
    },
    prCardMain: { padding: 14, alignItems: 'center' },
    prActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    prActionBtn: { flex: 1, alignItems: 'center', paddingVertical: 9 },
    prActionBtnDelete: { borderLeftWidth: 1, borderLeftColor: '#f0f0f0' },

    exerciseName: { fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 8, lineHeight: 16 },
    weightRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    weightValue: { fontSize: 28, fontWeight: '700', color: '#007AFF' },
    weightUnit: { fontSize: 13, color: '#888' },
    recordedAt: { fontSize: 10, color: '#bbb', marginTop: 5 },
    calcHint: { fontSize: 11, color: '#007AFF', marginTop: 4 },

    fab: {
        position: 'absolute',
        bottom: 24,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#007AFF',
        shadowOpacity: 0.4,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 6,
    },

    emptyText: { fontSize: 15, color: '#999', textAlign: 'center', lineHeight: 22 },
    errorText: { fontSize: 14, color: '#d00', textAlign: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', flex: 1 },
    prRef: { fontSize: 13, color: '#888', marginBottom: 12 },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderColor: '#eee',
        paddingBottom: 6,
        marginBottom: 4,
    },
    tableRow: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 1, borderColor: '#f5f5f5' },
    tableRowPR: { backgroundColor: '#f0f6ff' },
    tableCell: { flex: 1, fontSize: 14, color: '#1a1a1a', textAlign: 'center' },
    tableCellHeader: { fontWeight: '700', color: '#888', fontSize: 12 },
    tablePct: { fontWeight: '600', color: '#444' },
    tableRounded: { fontWeight: '700', color: '#007AFF' },
    disclaimer: { fontSize: 11, color: '#999', fontStyle: 'italic', marginTop: 12 },

    // Add / edit form
    inputLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 4, marginTop: 12 },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: '#1a1a1a',
        backgroundColor: '#fafafa',
    },
    inputDisabled: { backgroundColor: '#f0f0f0', color: '#999' },
    unitRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    unitBtn: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingVertical: 9,
        alignItems: 'center',
        backgroundColor: '#fafafa',
    },
    unitBtnSelected: { borderColor: '#007AFF', backgroundColor: '#EBF5FF' },
    unitBtnText: { fontSize: 14, fontWeight: '600', color: '#666' },
    unitBtnTextSelected: { color: '#007AFF' },
    formError: { fontSize: 13, color: '#d00', marginTop: 8 },
    modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
    cancelButton: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: '#f2f2f2',
    },
    cancelButtonText: { fontSize: 15, fontWeight: '600', color: '#444' },
    confirmButton: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: '#007AFF',
    },
    confirmButtonDisabled: { opacity: 0.5 },
    confirmButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
