/**
 * Protected group layout — tab navigation for authenticated screens.
 */

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';

import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedLayout(): React.JSX.Element {
    const { signOut } = useAuth();

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#007AFF',
                tabBarInactiveTintColor: '#999',
                headerShown: true,
                headerRight: () => (
                    <Pressable
                        onPress={signOut}
                        style={{ marginRight: 16 }}
                        accessibilityLabel="Logout"
                        accessibilityRole="button"
                    >
                        <Text style={{ color: '#FF3B30', fontSize: 15 }}>Logout</Text>
                    </Pressable>
                ),
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Coach',
                    tabBarLabel: 'Coach',
                    tabBarAccessibilityLabel: 'Coach chat tab',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Dashboard',
                    tabBarLabel: 'Dashboard',
                    tabBarAccessibilityLabel: 'Dashboard overview tab',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="bar-chart-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="calendar"
                options={{
                    title: 'Calendar',
                    tabBarLabel: 'Calendar',
                    tabBarAccessibilityLabel: 'Training calendar tab',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="calendar-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="prs"
                options={{
                    title: 'PRs',
                    tabBarLabel: 'PRs',
                    tabBarAccessibilityLabel: 'Personal records tab',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="trophy-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="nutrition"
                options={{
                    title: 'Nutrition',
                    tabBarLabel: 'Diet',
                    tabBarAccessibilityLabel: 'Nutrition and meals tab',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="nutrition-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="biometrics"
                options={{
                    title: 'Biometrics',
                    tabBarLabel: 'Body',
                    tabBarAccessibilityLabel: 'Biometrics tab',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="body-outline" size={size} color={color} />
                    ),
                }}
            />
            {/* Session detail — navigable but not shown in tab bar */}
            <Tabs.Screen
                name="session/[id]"
                options={{ href: null }}
            />
        </Tabs>
    );
}
