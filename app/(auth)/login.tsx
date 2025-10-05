import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Keyboard, TouchableOpacity, TouchableWithoutFeedback, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../constants/colors';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { signInWithGoogle } from '../../utils/googleAuth';
import { createProfileWithGoogleAvatar } from '../../utils/profileUtils';

export default function Login() {
  const params = useLocalSearchParams();
  const [email, onChangeEmail] = useState(params.email as string || '');
  const [password, onChangePassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signInWithEmail() {
    Keyboard.dismiss();
    if (email && password) {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
  
      if (error) {
        Alert.alert('Login Error', error.message);
        setLoading(false);
        return;
      }

      // Check if user's email is verified by checking their profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('email_verified')
        .eq('id', data.user.id)
        .single();

      if (!profileError && profileData && profileData.email_verified !== true) {
        // Email not verified - sign out to prevent session persistence
        await supabase.auth.signOut();
        
        // Navigate immediately for better UX
        router.replace({
          pathname: "/(auth)/verification",
          params: { email: email }
        });
        
        // Send OTP in background - user can manually resend if needed
        supabase.auth.signInWithOtp({
          email: email,
          options: {
            shouldCreateUser: false,
          }
        }).catch(error => {
          console.log('Background OTP send failed (user can resend manually):', error);
        });
        
        setLoading(false);
        return;
      }

      // Email is verified, proceed normally
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      const { data, error, googleUserInfo } = await signInWithGoogle();
      
      if (error) {
        Alert.alert('Google Sign In Failed', error.message || 'Failed to sign in with Google');
        return;
      }

      if (data?.user) {
        // Create or update profile with Google avatar if it's a new user
        await createProfileWithGoogleAvatar(data.user, googleUserInfo);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
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
    logInButton: {
      backgroundColor: (email && password) ? colors.brand : colors.secondaryAccent,
      color: colors.primaryText,
      width: '100%',
      height: 48,
      borderRadius: 8,
      marginBottom: 16,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    logInButtonText: {
      color: colors.primaryText,
      fontWeight: 'bold',
      fontSize: 16,
    },
    divider: {
      marginTop: -12,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      gap: 20,
    },
    dividerLine: {
      height: 1,
      backgroundColor: colors.secondaryAccent,
      flexGrow: 1,
    },
    dividerText: {
      color: colors.primaryText,
      fontSize: 16,
    },
    socialButton: {
      backgroundColor: colors.background,
      borderColor: colors.primaryText,
      borderWidth: 2,
      color: colors.primaryText,
      width: '100%',
      height: 48,
      borderRadius: 12,
      marginBottom: 16,
      display: 'flex',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    socialButtonText: {
      color: colors.primaryText,
      fontWeight: 'bold',
      fontSize: 16,
    },
    logInButtonDisabled: {
      backgroundColor: colors.secondaryAccent,
      opacity: 0.7,
    },
    buttonDisabled: {
      borderColor: colors.secondaryText,
      opacity: 0.7,
    },
    textDisabled: {
      color: colors.secondaryText,
    }
  });

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <TouchableOpacity
                  activeOpacity={0.5} onPress={() => router.back()} style={styles.backButton}>
          <IonIcon name="arrow-back" size={24} color={colors.primaryText} />
        </TouchableOpacity>
      <Text style={styles.title}>Log in to Atlas</Text>
      <View style={styles.inputContainer}>
        <Text style={styles.inputName}>Email</Text>
        <TextInput
          style={styles.input}
          onChangeText={onChangeEmail}
          value={email}
          placeholder="example@example.com"
          placeholderTextColor={'rgba(255, 255, 255, 0.5)'}
        />
      </View>
      <View style={styles.inputContainer}>
        <Text style={styles.inputName}>Password</Text>
        <TextInput
          style={styles.input}
          onChangeText={onChangePassword}
          value={password}
          textContentType='newPassword'
          secureTextEntry={true}
        />
      </View>
      <TouchableOpacity
                activeOpacity={0.5} 
        style={[
          styles.logInButton, 
          (loading || !email || !password) && styles.logInButtonDisabled
        ]}
        onPress={signInWithEmail}
        disabled={loading || !email || !password}
      >
          <Text style={styles.logInButtonText}>Log in</Text>
      </TouchableOpacity>
      <View style={styles.divider}>
        <View style={styles.dividerLine}></View>
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine}></View>
      </View>
      <TouchableOpacity
                activeOpacity={0.5}
        style={[styles.socialButton, styles.buttonDisabled]}
        onPress={handleGoogleSignIn}
        disabled={true}
      >
        <IonIcon name="logo-google" size={24} color={colors.secondaryText} />
        <Text style={[styles.socialButtonText, styles.textDisabled]}>Continue With Google (Disabled)</Text>
      </TouchableOpacity>
    </View>
    </TouchableWithoutFeedback>
  );
}