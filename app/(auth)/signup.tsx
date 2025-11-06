import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Keyboard, TouchableOpacity, TouchableWithoutFeedback, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../constants/colors';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { signInWithGoogle } from '../../utils/googleAuth';
import { createProfileWithGoogleAvatar } from '../../utils/profileUtils';

export default function Signup() {
  const [email, onChangeEmail] = useState('');
  const [password, onChangePassword] = useState('');
  const [confirmPassword, onChangeConfirmPassword] = useState('');
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleTermsPress = () => {
    router.push('/(legal)/terms');
  };

  const handlePrivacyPress = () => {
    router.push('/(legal)/privacy');
  };

  const handleEulaPress = () => {
    router.push('/(legal)/eula');
  };

  async function handleGoogleSignUp() {
    if (!eulaAccepted) {
      Alert.alert('EULA Required', 'You must agree to the End User License Agreement to create an account.');
      return;
    }

    setLoading(true);
    try {
      const { data, error, googleUserInfo } = await signInWithGoogle();
      
      if (error) {
        Alert.alert('Error', error.message || 'Failed to sign in with Google');
        return;
      }

      if (data?.user) {
        // Create or update profile with Google avatar
        await createProfileWithGoogleAvatar(data.user, googleUserInfo);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithEmail() {
    Keyboard.dismiss();
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!eulaAccepted) {
      Alert.alert('EULA Required', 'You must agree to the End User License Agreement to create an account.');
      return;
    }

    if (email && password && confirmPassword) {
      setLoading(true)
      
      // First, sign up the user with email/password
      const {
        data: signUpData,
        error: signUpError,
      } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: undefined, // Disable email link verification
        }
      });
  
      if (signUpError) {
        console.log(signUpError);
        Alert.alert('Error', signUpError.message);
        setLoading(false);
        return;
      }

      console.log(signUpData.user);
      
      if (signUpData.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
        Alert.alert(
          'Account Exists', 
          'An account with this email already exists.'
        );
        setLoading(false);
        return;
      }

      // Sign out to prevent session persistence before verification
      await supabase.auth.signOut();
      
      // Navigate immediately for better UX
      router.replace({
        pathname: "/(auth)/verification",
        params: { 
          email: email,
          isSignup: 'true' // Flag to indicate this is signup verification
        }
      });
      
      // Send OTP in background - user can manually resend if needed
      supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false, // User already created above
        }
      }).catch(error => {
        console.log('Background OTP send failed (user can resend manually):', error);
      });
      
      setLoading(false)
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
    infoText: {
      width: '100%',
      fontSize: 13,
      color: colors.primaryText,
    },
    linkText: {
      color: colors.primaryText,
      textDecorationLine: 'underline',
      fontSize: 13,
    },
    signUpButton: {
      backgroundColor: colors.brand,
      color: colors.primaryText,
      width: '100%',
      height: 48,
      borderRadius: 8,
      marginBottom: 16,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    signUpButtonText: {
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
    signUpButtonDisabled: {
      backgroundColor: colors.secondaryAccent,
      opacity: 0.7,
    },
    buttonDisabled: {
      borderColor: colors.secondaryText,
      opacity: 0.7,
    },
    textDisabled: {
      color: colors.secondaryText,
    },
    eulaContainer: {
      width: '100%',
      marginBottom: 12,
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderColor: colors.secondaryAccent,
      borderRadius: 4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    eulaText: {
      flex: 1,
      fontSize: 14,
      color: colors.primaryText,
      lineHeight: 20,
    },
  });

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <TouchableOpacity
                  activeOpacity={0.5} onPress={() => router.back()} style={styles.backButton}>
          <IonIcon name="arrow-back" size={24} color={colors.primaryText} />
        </TouchableOpacity>
      <Text style={styles.title}>Create an Account</Text>
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
      <View style={styles.inputContainer}>
        <Text style={styles.inputName}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          onChangeText={onChangeConfirmPassword}
          value={confirmPassword}
          textContentType='password'
          secureTextEntry={true}
        />
      </View>
      
      <View style={styles.eulaContainer}>
        <TouchableOpacity 
          style={styles.checkboxContainer} 
          onPress={() => setEulaAccepted(!eulaAccepted)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, eulaAccepted && styles.checkboxChecked]}>
            {eulaAccepted && (
              <IonIcon name="checkmark" size={16} color={colors.primaryText} />
            )}
          </View>
          <Text style={styles.eulaText}>
            I agree to the{' '}
            <Text style={styles.linkText} onPress={handleEulaPress}>
              End User License Agreement
            </Text>
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.infoText}>
        By signing up you are agreeing to our{' '}
        <Text style={styles.linkText} onPress={handleTermsPress}>
          Terms of Service
        </Text>
        . View our{' '}
        <Text style={styles.linkText} onPress={handlePrivacyPress}>
          Privacy Policy
        </Text>
        .
      </Text>
      <TouchableOpacity
                activeOpacity={0.5} 
        style={[
          styles.signUpButton, 
          (loading || !email || !password || !confirmPassword || !eulaAccepted) && styles.signUpButtonDisabled
        ]}
        onPress={signUpWithEmail}
        disabled={loading || !email || !password || !confirmPassword || !eulaAccepted}
      >
          <Text style={styles.signUpButtonText}>Sign up</Text>
      </TouchableOpacity>
      <View style={styles.divider}>
        <View style={styles.dividerLine}></View>
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine}></View>
      </View>
      <TouchableOpacity
                activeOpacity={0.5}
        style={[styles.socialButton, styles.buttonDisabled]}
        onPress={handleGoogleSignUp}
        disabled={true}
      >
        <IonIcon name="logo-google" size={24} color={colors.secondaryText} />
        <Text style={[styles.socialButtonText, styles.textDisabled]}>Continue With Google (Disabled)</Text>
      </TouchableOpacity>
    </View>
    </TouchableWithoutFeedback>
  );
}