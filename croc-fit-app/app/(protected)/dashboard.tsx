/**
 * Dashboard screen — 7-day training and biometrics overview.
 * Implements AC-006: useful insights on 7-day trend.
 * Implements REQ-018: biometric trend insight.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../lib/api';

interface WorkoutSession {
    id: string;
    title: string;
    scheduled_date: string;
    status: 'planned' | 'completed' | 'skipped';
    rpe?: number;
}

interface BiometricEntry {
    date: string;
    weight_kg?: number;
    sleep_hours?: number;
    readiness?: number;
}

interface InsightSummary {
    recent_workouts: WorkoutSession[];
    biometric_trend_7d: BiometricEntry[];
    biometric_trend_30d: BiometricEntry[];
}

function average(values: (number | undefined)[]): string {
    const nums = values.filter((v): v is number => v !== undefined);
    if (!nums.length) return '—';
    return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
}

function statColor(value: number | undefined, type: 'readiness' | 'sleep'): string {
    if (value === undefined) return '#999';
    if (type === 'readiness') return value >= 7 ? '#34C759' : value >= 4 ? '#FF9500' : '#FF3B30';
    if (type === 'sleep') return value >= 7 ? '#34C759' : value >= 6 ? '#FF9500' : '#FF3B30';
    return '#007AFF';
}

export default function DashboardScreen(): React.JSX.Element {
    const { session } = useAuth();
    const [summary, setSummary] = useState<InsightSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const userId = session?.user?.id ?? '';
    const accessToken = session?.access_token;

    function load(): void {
        if (!userId) return;
        setIsLoading(true);
        apiGet<InsightSummary>('/api/v1/insights/summary', { user_id: userId }, accessToken)
            .then(setSummary)
            .catch((err: Error) => setError(err.message))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#007AFF" accessibilityLabel="Loading dashboard" />
            </View>
        );
    }

    if (error || !summary) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText} accessibilityRole="alert">
                    {error ?? 'Failed to load dashboard'}
                </Text>
                <Pressable style={styles.retryButton} onPress={load} accessibilityRole="button" accessibilityLabel="Retry">
                    <Text style={styles.retryText}>Retry</Text>
                </Pressable>
            </View>
        );
    }

    const workouts = summary.recent_workouts ?? [];
    const bio7d = summary.biometric_trend_7d ?? [];

    const completedCount = workouts.filter((w) => w.status === 'completed').length;
    const plannedCount = workouts.filter((w) => w.status === 'planned').length;
    const avgRpe = average(workouts.map((w) => w.rpe));

    const avgReadiness = average(bio7d.map((b) => b.readiness));
    const avgSleep = average(bio7d.map((b) => b.sleep_hours));
    const avgWeight = average(bio7d.map((b) => b.weight_kg));

    const lastReadiness = bio7d[bio7d.length - 1]?.readiness;
    const lastSleep = bio7d[bio7d.length - 1]?.sleep_hours;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Weekly summary */}
            <Text style={styles.sectionTitle} accessibilityRole="header">
                Last 7 days
            </Text>

            <View style={styles.statsRow}>
                <View
                    style={[styles.statCard, styles.statCardGreen]}
                    accessibilityLabel={`${completedCount} sessions completed`}
                >
                    <Text style={styles.statValue}>{completedCount}</Text>
                    <Text style={styles.statLabel}>Completed</Text>
                </View>
                <View
                    style={[styles.statCard, styles.statCardBlue]}
                    accessibilityLabel={`${plannedCount} sessions planned`}
                >
                    <Text style={styles.statValue}>{plannedCount}</Text>
                    <Text style={styles.statLabel}>Planned</Text>
                </View>
                <View
                    style={[styles.statCard, styles.statCardOrange]}
                    accessibilityLabel={`Average RPE ${avgRpe}`}
                >
                    <Text style={styles.statValue}>{avgRpe}</Text>
                    <Text style={styles.statLabel}>Avg RPE</Text>
                </View>
            </View>

            {/* Biometric snapshot */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]} accessibilityRole="header">
                Body metrics (7d avg)
            </Text>

            <View style={styles.statsRow}>
                <View
                    style={[styles.statCard]}
                    accessibilityLabel={`Average readiness ${avgReadiness} out of 10`}
                >
                    <Text style={[styles.statValue, { color: statColor(lastReadiness, 'readiness') }]}>
                        {avgReadiness}
                    </Text>
                    <Text style={styles.statLabel}>Readiness</Text>
                </View>
                <View
                    style={[styles.statCard]}
                    accessibilityLabel={`Average sleep ${avgSleep} hours`}
                >
                    <Text style={[styles.statValue, { color: statColor(lastSleep, 'sleep') }]}>
                        {avgSleep}h
                    </Text>
                    <Text style={styles.statLabel}>Sleep</Text>
                </View>
                <View style={[styles.statCard]} accessibilityLabel={`Average weight ${avgWeight} kg`}>
                    <Text style={styles.statValue}>{avgWeight}</Text>
                    <Text style={styles.statLabel}>Weight kg</Text>
                </View>
            </View>

            {/* Recent workouts list */}
            {workouts.length > 0 && (
                <>
                    <Text style={[styles.sectionTitle, { marginTop: 24 }]} accessibilityRole="header">
                        Recent sessions
                    </Text>
                    {workouts.slice(0, 5).map((w) => (
                        <View
                            key={w.id}
                            style={styles.sessionRow}
                            accessibilityLabel={`${w.title} — ${w.status}${w.rpe ? `, RPE ${w.rpe}` : ''}`}
                        >
                            <View
                                style={[
                                    styles.dot,
                                    {
                                        backgroundColor:
                                            w.status === 'completed'
                                                ? '#34C759'
                                                : w.status === 'planned'
                                                  ? '#007AFF'
                                                  : '#FF3B30',
                                    },
                                ]}
                            />
                            <View style={styles.sessionInfo}>
                                <Text style={styles.sessionTitle}>{w.title}</Text>
                                <Text style={styles.sessionDate}>{w.scheduled_date}</Text>
                            </View>
                            {w.rpe ? (
                                <Text style={styles.rpe}>RPE {w.rpe}</Text>
                            ) : null}
                        </View>
                    ))}
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    content: { padding: 16, paddingBottom: 40 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    errorText: { color: '#FF3B30', fontSize: 16, textAlign: 'center', marginBottom: 16 },
    retryButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    retryText: { color: '#fff', fontWeight: '600' },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
    statsRow: { flexDirection: 'row', gap: 10 },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    statCardGreen: { borderTopWidth: 3, borderTopColor: '#34C759' },
    statCardBlue: { borderTopWidth: 3, borderTopColor: '#007AFF' },
    statCardOrange: { borderTopWidth: 3, borderTopColor: '#FF9500' },
    statValue: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
    statLabel: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
    sessionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        gap: 10,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    sessionInfo: { flex: 1 },
    sessionTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
    sessionDate: { fontSize: 12, color: '#888', marginTop: 2 },
    rpe: { fontSize: 12, fontWeight: '600', color: '#FF9500' },
});
