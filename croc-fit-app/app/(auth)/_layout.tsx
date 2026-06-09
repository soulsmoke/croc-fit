/**
 * Auth group layout — no header, plain stack navigation.
 */

import { Stack } from 'expo-router';

export default function AuthLayout(): React.JSX.Element {
    return <Stack screenOptions={{ headerShown: false }} />;
}
