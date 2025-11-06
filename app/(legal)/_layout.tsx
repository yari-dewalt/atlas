import { Stack } from 'expo-router';

export default function LegalLayout() {
  return (
    <Stack>
      <Stack.Screen name="privacy" options={{ headerShown: false }} />
      <Stack.Screen name="terms" options={{ headerShown: false }} />
      <Stack.Screen name="eula" options={{ headerShown: false }} />
    </Stack>
  );
}