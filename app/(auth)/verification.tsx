import { View, Text, StyleSheet, TextInput, Pressable, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useBannerStore } from '../../stores/bannerStore';

export default function Signup() {
  const router = useRouter();
  const { email } = useLocalSearchParams();
  const { showError, showSuccess } = useBannerStore();

  const handleResendEmail = async () => {
    if (!email) return;
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email as string,
    });

    if (error) {
      showError(error.message);
    } else {
      showSuccess('Verification email sent!');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.back()} style={styles.backButton}>
        <IonIcon name="arrow-back" size={24} color={colors.primaryText} />
      </TouchableOpacity>
      <Text style={styles.title}>Verification</Text>
      <Text style={styles.text}>Email Verification Sent!</Text>
      <Text style={styles.text}>We've sent a verification link to your email address. Please check your inbox and click the link to verify your account.</Text>
      <Text style={styles.text}>Haven't received the email? Check your spam folder or click the button below to resend the verification email.</Text>
      <Text style={styles.noteText}>Note: The verification link will expire in 24 hours.</Text>
      <TouchableOpacity
                activeOpacity={0.5} style={styles.logInButton}
      onPress={() => router.replace("/(auth)/login")}>
        <Text style={styles.logInButtonText}>Log in</Text>
      </TouchableOpacity>
      <TouchableOpacity
                activeOpacity={0.5} style={styles.verificationButton}
        onPress={handleResendEmail}>
        <Text style={styles.verificationButtonText}>Re-send verification email</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
  },
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 20,
    paddingTop: 90,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 30,
    color: colors.primaryText,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  text: {
    color: colors.primaryText,
    fontSize: 16,
  },
  noteText: {
    color: colors.secondaryText,
    fontSize: 16,
  },
  logInButton: {
    backgroundColor: colors.brand,
    color: colors.primaryText,
    width: '100%',
    height: 48,
    borderRadius: 8,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
  },
  logInButtonText: {
    color: colors.primaryText,
    fontWeight: 'bold',
    fontSize: 16,
  },
  verificationButton: {
    backgroundColor: colors.background,
    color: colors.primaryText,
    width: '100%',
    height: 48,
    borderRadius: 8,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  verificationButtonText: {
    color: colors.brand,
    fontWeight: 'bold',
    fontSize: 16,
  },
});