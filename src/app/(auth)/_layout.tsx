import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'login' };

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
