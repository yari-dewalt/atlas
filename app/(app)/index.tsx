import { Redirect } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';

export default function Index() {
  const { session, loading } = useAuthStore();
  
  // Initial redirect based on auth status
  if (!loading) {
    if (session) {
      return <Redirect href="/(app)/home" />;
    } else {
      return <Redirect href="/(auth)/auth" />;
    }
  }
  
  // Return null while loading
  return null;
}