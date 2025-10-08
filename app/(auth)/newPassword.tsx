import { View, Text, StyleSheet, TextInput, TouchableOpacity, Keyboard, TouchableWithoutFeedback, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';

export default function NewPassword() {
  const router = useRouter();
  const { email } = useLocalSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Password validation function
  const isValidPassword = (password: string) => {
    return password.length >= 6;
  };

  const passwordsMatch = password === confirmPassword;

  const handleUpdatePassword = async () => {
    if (!isValidPassword(password)) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    if (!passwordsMatch) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    
    try {
      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        Alert.alert('Error', error.message);
        setLoading(false);
        return;
      }

      // Sign out the user after password reset for security
      await supabase.auth.signOut();

      Alert.alert(
        'Password Updated',
        'Your password has been successfully updated. Please log in with your new password.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.dismissTo({
                pathname: '/(auth)/auth',
              });
              router.push({
                pathname: '/(auth)/login',
                params: { email: email }
              });
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update password');
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
        
        <Text style={styles.title}>New Password</Text>
        <Text style={styles.description}>
          Enter your new password for:
        </Text>
        <Text style={styles.emailText}>{email}</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputName}>New Password</Text>
          <TextInput
            style={[
              styles.input,
              password && !isValidPassword(password) && styles.inputError
            ]}
            onChangeText={setPassword}
            value={password}
            textContentType='newPassword'
            secureTextEntry={true}
            placeholder="Enter new password"
            placeholderTextColor={'rgba(255, 255, 255, 0.5)'}
            autoFocus={true}
          />
          {password && !isValidPassword(password) && (
            <Text style={[styles.errorText, { marginBottom: -8}]}>
              Password must be at least 6 characters long
            </Text>
          )}
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputName}>Confirm Password</Text>
          <TextInput
            style={[
              styles.input,
              confirmPassword && !passwordsMatch && styles.inputError
            ]}
            onChangeText={setConfirmPassword}
            value={confirmPassword}
            textContentType='password'
            secureTextEntry={true}
            placeholder="Confirm new password"
            placeholderTextColor={'rgba(255, 255, 255, 0.5)'}
          />
          {confirmPassword && !passwordsMatch && (
            <Text style={styles.errorText}>
              Passwords do not match
            </Text>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.5} 
          style={[
            styles.updateButton, 
            (loading || !password || !confirmPassword || !isValidPassword(password) || !passwordsMatch) && styles.updateButtonDisabled
          ]}
          onPress={handleUpdatePassword}
          disabled={loading || !password || !confirmPassword || !isValidPassword(password) || !passwordsMatch}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.updateButtonText}>Update Password</Text>
          )}
        </TouchableOpacity>
        
        <Text style={styles.noteText}>
          Your password must be at least 6 characters long.
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
    marginBottom: 10,
  },
  description: {
    color: colors.primaryText,
    fontSize: 16,
    textAlign: 'center',
  },
  emailText: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: '100%',
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
  updateButton: {
    backgroundColor: colors.brand,
    width: '100%',
    height: 48,
    borderRadius: 8,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  updateButtonDisabled: {
    backgroundColor: colors.secondaryAccent,
    opacity: 0.7,
  },
  updateButtonText: {
    color: colors.primaryText,
    fontWeight: 'bold',
    fontSize: 16,
  },
  noteText: {
    color: colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  inputError: {
    borderColor: colors.notification,
  },
  errorText: {
    color: colors.notification,
    fontSize: 14,
    marginTop: -4,
    marginBottom: -16,
  },
});
