import { View, Text, StyleSheet, TextInput, TouchableOpacity, Keyboard, TouchableWithoutFeedback, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [email, setEmail] = useState(params.email as string || '');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  // Email validation function
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const handleSendResetCode = async () => {
    if (!isValidEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    
    try {
      // Send OTP for password reset
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false, // User must already exist
        }
      });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to send reset code');
        setLoading(false);
        return;
      }

      // Show success message and set state
      setCodeSent(true);
      Alert.alert(
        'Reset Code Sent', 
        `We've sent a verification code to ${email.trim()}. Please check your email and enter the code on the next screen.`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace({
                pathname: "/(auth)/verification",
                params: { 
                  email: email.trim(),
                  isPasswordReset: 'true' // Flag to indicate this is password reset
                }
              });
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <TouchableOpacity
          activeOpacity={0.5} 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <IonIcon name="arrow-back" size={24} color={colors.primaryText} />
        </TouchableOpacity>
        
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.description}>
          Enter your email address and we'll send you a verification code to reset your password.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputName}>Email</Text>
          <TextInput
            style={styles.input}
            onChangeText={setEmail}
            value={email}
            placeholder="example@example.com"
            placeholderTextColor={'rgba(255, 255, 255, 0.5)'}
            keyboardType="email-address"
            autoCapitalize="none"
            autoFocus={!email} // Auto-focus if no email provided
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.5} 
          style={[styles.sendButton, (loading || !isValidEmail(email)) && styles.sendButtonDisabled]}
          onPress={handleSendResetCode}
          disabled={loading || !isValidEmail(email)}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.sendButtonText}>Send Reset Code</Text>
          )}
        </TouchableOpacity>
        
        <Text style={styles.noteText}>
          If you don't receive the code, check your spam folder or try again.
        </Text>
      </View>
    </TouchableWithoutFeedback>
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
    alignItems: 'center',
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
    marginBottom: 20,
  },
  description: {
    color: colors.primaryText,
    fontSize: 16,
    textAlign: 'center',
  },
  inputContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: '100%',
    marginTop: 20,
  },
  inputName: {
    color: colors.primaryText,
    fontSize: 16,
  },
  input: {
    borderColor: colors.secondaryAccent,
    borderWidth: 2,
    color: colors.primaryText,
    borderRadius: 6,
    width: '100%',
    padding: 12,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: colors.brand,
    width: '100%',
    height: 48,
    borderRadius: 8,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  sendButtonDisabled: {
    backgroundColor: colors.secondaryAccent,
    opacity: 0.7,
  },
  sendButtonText: {
    color: colors.primaryText,
    fontWeight: 'bold',
    fontSize: 16,
  },
  noteText: {
    color: colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
});
