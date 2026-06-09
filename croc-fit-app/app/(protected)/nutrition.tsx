/**
 * Nutrition screen — targets management + daily meal log.
 * Implements REQ-019, REQ-020, REQ-021, REQ-025.
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
import { apiGet, apiPost, apiPut } from '../../lib/api';

interface NutritionTarget {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
}

interface MealEntry {
    id: string;
    date: string;
    description: string;
    source: string;
    created_at?: string;
}

type Tab = 'targets' | 'meals';

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function macroBar(value: number, max: number, color: string): React.JSX.Element {
    const pct = Math.min((value / max) * 100, 100);
    return (
        <View style={barStyles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: value }}>
            <View style={[barStyles.fill, { width: `${pct}%` as `${number}%`, backgroundColor: color }]} />
        </View>
    );
}

const barStyles = StyleSheet.create({
    track: { height: 6, backgroundColor: '#eee', borderRadius: 3, marginTop: 4, overflow: 'hidden' },
    fill: { height: 6, borderRadius: 3 },
});

export default function NutritionScreen(): React.JSX.Element {
    const { session } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('targets');

    // Targets state
    const [targets, setTargets] = useState<NutritionTarget | null>(null);
    const [isLoadingTargets, setIsLoadingTargets] = useState(true);
    const [showTargetsModal, setShowTargetsModal] = useState(false);
    const [targetForm, setTargetForm] = useState({ kcal: '', protein_g: '', carbs_g: '', fat_g: '' });
    const [isSavingTargets, setIsSavingTargets] = useState(false);
    const [targetError, setTargetError] = useState<string | null>(null);

    // Meals state
    const [meals, setMeals] = useState<MealEntry[]>([]);
    const [mealsDate, setMealsDate] = useState(todayISO());
    const [isLoadingMeals, setIsLoadingMeals] = useState(false);
    const [showMealModal, setShowMealModal] = useState(false);
    const [mealDesc, setMealDesc] = useState('');
    const [isSavingMeal, setIsSavingMeal] = useState(false);
    const [mealError, setMealError] = useState<string | null>(null);

    const userId = session?.user?.id ?? '';
    const accessToken = session?.access_token;

    // Load targets
    useEffect(() => {
        if (!userId) return;
        apiGet<NutritionTarget>('/api/v1/nutrition/targets', { user_id: userId }, accessToken)
            .then(setTargets)
            .catch(() => setTargets(null))
            .finally(() => setIsLoadingTargets(false));
    }, [userId, accessToken]);

    // Load meals when tab or date changes
    useEffect(() => {
        if (activeTab !== 'meals' || !userId) return;
        setIsLoadingMeals(true);
        apiGet<MealEntry[]>('/api/v1/meals', { user_id: userId, date: mealsDate }, accessToken)
            .then(setMeals)
            .catch(() => setMeals([]))
            .finally(() => setIsLoadingMeals(false));
    }, [activeTab, userId, mealsDate, accessToken]);

    async function saveTargets(): Promise<void> {
        const kcal = parseInt(targetForm.kcal, 10);
        const protein = parseFloat(targetForm.protein_g);
        const carbs = parseFloat(targetForm.carbs_g);
        const fat = parseFloat(targetForm.fat_g);
        if (isNaN(kcal) || isNaN(protein) || isNaN(carbs) || isNaN(fat)) {
            setTargetError('All fields required and must be numbers');
            return;
        }
        setIsSavingTargets(true);
        setTargetError(null);
        try {
            const updated = await apiPut<NutritionTarget>(
                '/api/v1/nutrition/targets',
                { kcal, protein_g: protein, carbs_g: carbs, fat_g: fat },
                accessToken,
                { user_id: userId },
            );
            setTargets(updated);
            setShowTargetsModal(false);
        } catch (err: unknown) {
            setTargetError(err instanceof Error ? err.message : 'Save failed');
        } finally {
            setIsSavingTargets(false);
        }
    }

    async function saveMeal(): Promise<void> {
        if (!mealDesc.trim()) {
            setMealError('Description required');
            return;
        }
        setIsSavingMeal(true);
        setMealError(null);
        try {
            await apiPost<MealEntry>(
                '/api/v1/meals',
                { date: mealsDate, description: mealDesc.trim(), source: 'text' },
                { user_id: userId },
                accessToken,
            );
            setMealDesc('');
            setShowMealModal(false);
            // Refresh
            const updated = await apiGet<MealEntry[]>('/api/v1/meals', { user_id: userId, date: mealsDate }, accessToken);
            setMeals(updated);
        } catch (err: unknown) {
            setMealError(err instanceof Error ? err.message : 'Save failed');
        } finally {
            setIsSavingMeal(false);
        }
    }

    function openTargetsModal(): void {
        setTargetForm({
            kcal: targets?.kcal.toString() ?? '',
            protein_g: targets?.protein_g.toString() ?? '',
            carbs_g: targets?.carbs_g.toString() ?? '',
            fat_g: targets?.fat_g.toString() ?? '',
        });
        setTargetError(null);
        setShowTargetsModal(true);
    }

    const targetsContent = isLoadingTargets ? (
        <View style={styles.centered}>
            <ActivityIndicator size="large" color="#007AFF" accessibilityLabel="Loading nutrition targets" />
        </View>
    ) : (
        <ScrollView contentContainerStyle={styles.targetsContainer}>
            {targets ? (
                <View style={styles.targetCard}>
                    <View style={styles.targetRow}>
                        <Text style={styles.targetKcal} accessibilityLabel={`${targets.kcal} kcal daily target`}>
                            {targets.kcal}
                        </Text>
                        <Text style={styles.targetKcalLabel}>kcal / day</Text>
                    </View>
                    <View style={styles.macroRow}>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{targets.protein_g}g</Text>
                            <Text style={styles.macroLabel}>Protein</Text>
                            {macroBar(targets.protein_g, 200, '#007AFF')}
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{targets.carbs_g}g</Text>
                            <Text style={styles.macroLabel}>Carbs</Text>
                            {macroBar(targets.carbs_g, 300, '#FF9500')}
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{targets.fat_g}g</Text>
                            <Text style={styles.macroLabel}>Fat</Text>
                            {macroBar(targets.fat_g, 100, '#FF3B30')}
                        </View>
                    </View>
                    <Text style={styles.disclaimer}
                        accessibilityLabel="Disclaimer: these targets are for reference only. Consult a registered dietitian before making significant dietary changes.">
                        These targets are for reference only. Consult a registered dietitian before making
                        significant dietary changes.
                    </Text>
                </View>
            ) : (
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>No targets set. Tap Edit to configure.</Text>
                </View>
            )}
            <Pressable
                style={styles.editBtn}
                onPress={openTargetsModal}
                accessibilityRole="button"
                accessibilityLabel="Edit nutrition targets"
            >
                <Text style={styles.editBtnText}>Edit targets</Text>
            </Pressable>
        </ScrollView>
    );

    const mealsContent = (
        <View style={{ flex: 1 }}>
            {/* Date picker row */}
            <View style={styles.dateRow}>
                <Pressable
                    onPress={() => {
                        const d = new Date(mealsDate);
                        d.setDate(d.getDate() - 1);
                        setMealsDate(d.toISOString().slice(0, 10));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Previous day"
                    style={styles.dateArrow}
                >
                    <Text style={styles.dateArrowText}>{'<'}</Text>
                </Pressable>
                <Text style={styles.dateLabel} accessibilityRole="text">{mealsDate}</Text>
                <Pressable
                    onPress={() => {
                        const d = new Date(mealsDate);
                        d.setDate(d.getDate() + 1);
                        setMealsDate(d.toISOString().slice(0, 10));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Next day"
                    style={styles.dateArrow}
                >
                    <Text style={styles.dateArrowText}>{'>'}</Text>
                </Pressable>
            </View>

            {isLoadingMeals ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#007AFF" accessibilityLabel="Loading meals" />
                </View>
            ) : meals.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>No meals logged for {mealsDate}.</Text>
                </View>
            ) : (
                <FlatList
                    data={meals}
                    keyExtractor={(m) => m.id}
                    contentContainerStyle={styles.mealsList}
                    accessibilityRole="list"
                    accessibilityLabel="Meal entries"
                    renderItem={({ item }) => (
                        <View style={styles.mealCard} accessibilityLabel={`Meal: ${item.description}`}>
                            <Text style={styles.mealDesc}>{item.description}</Text>
                            <Text style={styles.mealSource}>{item.source}</Text>
                        </View>
                    )}
                />
            )}

            <Pressable
                style={styles.fab}
                onPress={() => { setMealDesc(''); setMealError(null); setShowMealModal(true); }}
                accessibilityRole="button"
                accessibilityLabel="Log a meal"
            >
                <Text style={styles.fabText} aria-hidden>+</Text>
            </Pressable>
        </View>
    );

    return (
        <>
            <View style={styles.container}>
                {/* Tab toggle */}
                <View style={styles.tabRow}>
                    <Pressable
                        style={[styles.tabBtn, activeTab === 'targets' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('targets')}
                        accessibilityRole="tab"
                        accessibilityLabel="Nutrition targets tab"
                        accessibilityState={{ selected: activeTab === 'targets' }}
                    >
                        <Text style={[styles.tabText, activeTab === 'targets' && styles.tabTextActive]}>Targets</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.tabBtn, activeTab === 'meals' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('meals')}
                        accessibilityRole="tab"
                        accessibilityLabel="Meal log tab"
                        accessibilityState={{ selected: activeTab === 'meals' }}
                    >
                        <Text style={[styles.tabText, activeTab === 'meals' && styles.tabTextActive]}>Meals</Text>
                    </Pressable>
                </View>

                {activeTab === 'targets' ? targetsContent : mealsContent}
            </View>

            {/* Edit targets modal */}
            <Modal
                visible={showTargetsModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowTargetsModal(false)}
                accessibilityViewIsModal
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle} accessibilityRole="header">Nutrition targets</Text>
                        <ScrollView>
                            {(['kcal', 'protein_g', 'carbs_g', 'fat_g'] as const).map((field) => (
                                <View key={field}>
                                    <Text style={styles.fieldLabel}>
                                        {field === 'kcal' ? 'Calories (kcal)' : field === 'protein_g' ? 'Protein (g)' : field === 'carbs_g' ? 'Carbs (g)' : 'Fat (g)'}
                                    </Text>
                                    <TextInput
                                        style={styles.input}
                                        value={targetForm[field]}
                                        onChangeText={(v) => setTargetForm((f) => ({ ...f, [field]: v }))}
                                        keyboardType="decimal-pad"
                                        accessibilityLabel={field}
                                    />
                                </View>
                            ))}
                            {targetError ? <Text style={styles.saveError} accessibilityRole="alert">{targetError}</Text> : null}
                            <View style={styles.modalActions}>
                                <Pressable style={styles.cancelBtn} onPress={() => setShowTargetsModal(false)} accessibilityRole="button" accessibilityLabel="Cancel">
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </Pressable>
                                <Pressable style={[styles.saveBtn, isSavingTargets && styles.saveBtnDisabled]} onPress={saveTargets} disabled={isSavingTargets} accessibilityRole="button" accessibilityLabel="Save targets">
                                    <Text style={styles.saveText}>{isSavingTargets ? 'Saving…' : 'Save'}</Text>
                                </Pressable>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Add meal modal */}
            <Modal
                visible={showMealModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowMealModal(false)}
                accessibilityViewIsModal
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle} accessibilityRole="header">Log meal</Text>
                        <Text style={styles.fieldLabel}>Description *</Text>
                        <TextInput
                            style={[styles.input, styles.inputMultiline]}
                            value={mealDesc}
                            onChangeText={setMealDesc}
                            placeholder="e.g. Chicken breast 200g, rice 150g, broccoli"
                            multiline
                            numberOfLines={4}
                            accessibilityLabel="Meal description"
                        />
                        <Text style={styles.disclaimer}
                            accessibilityLabel="Disclaimer: log is for personal tracking. Consult a dietitian for clinical nutrition advice.">
                            Log is for personal tracking. Consult a dietitian for clinical nutrition advice.
                        </Text>
                        {mealError ? <Text style={styles.saveError} accessibilityRole="alert">{mealError}</Text> : null}
                        <View style={styles.modalActions}>
                            <Pressable style={styles.cancelBtn} onPress={() => setShowMealModal(false)} accessibilityRole="button" accessibilityLabel="Cancel">
                                <Text style={styles.cancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={[styles.saveBtn, isSavingMeal && styles.saveBtnDisabled]} onPress={saveMeal} disabled={isSavingMeal} accessibilityRole="button" accessibilityLabel="Save meal">
                                <Text style={styles.saveText}>{isSavingMeal ? 'Saving…' : 'Save'}</Text>
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
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    tabRow: { flexDirection: 'row', margin: 16, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#007AFF', alignSelf: 'stretch' },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
    tabBtnActive: { backgroundColor: '#007AFF' },
    tabText: { fontSize: 14, fontWeight: '600', color: '#007AFF' },
    tabTextActive: { color: '#fff' },
    targetsContainer: { padding: 16, paddingBottom: 40 },
    targetCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    targetRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 20 },
    targetKcal: { fontSize: 40, fontWeight: '800', color: '#1a1a1a' },
    targetKcalLabel: { fontSize: 16, color: '#888' },
    macroRow: { flexDirection: 'row', gap: 12 },
    macroItem: { flex: 1 },
    macroValue: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
    macroLabel: { fontSize: 11, color: '#888', marginTop: 2 },
    disclaimer: { fontSize: 11, color: '#aaa', lineHeight: 16, marginTop: 16 },
    editBtn: { backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    editBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
    dateArrow: { padding: 8 },
    dateArrowText: { fontSize: 20, color: '#007AFF', fontWeight: '600' },
    dateLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
    mealsList: { padding: 16, paddingBottom: 90, gap: 10 },
    mealCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#eee' },
    mealDesc: { fontSize: 14, color: '#1a1a1a', lineHeight: 20 },
    mealSource: { fontSize: 11, color: '#aaa', marginTop: 4 },
    emptyText: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
    fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
    fabText: { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '300' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
    fieldLabel: { fontSize: 13, color: '#555', marginTop: 12, marginBottom: 4 },
    input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1a1a1a', backgroundColor: '#fafafa' },
    inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
    saveError: { color: '#FF3B30', fontSize: 13, marginTop: 8 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 8 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ccc', alignItems: 'center' },
    cancelText: { color: '#555', fontWeight: '600' },
    saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#007AFF', alignItems: 'center' },
    saveBtnDisabled: { backgroundColor: '#aaa' },
    saveText: { color: '#fff', fontWeight: '700' },
});
