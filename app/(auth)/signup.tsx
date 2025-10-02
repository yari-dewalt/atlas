import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Keyboard, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Link, useRouter } from 'expo-router';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../constants/colors';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { signInWithGoogle } from '../../utils/googleAuth';
import { createProfileWithGoogleAvatar } from '../../utils/profileUtils';
import { useBannerStore } from '../../stores/bannerStore';

export default function Signup() {
  const [email, onChangeEmail] = useState('');
  const [password, onChangePassword] = useState('');
  const [confirmPassword, onChangeConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showError } = useBannerStore();

  const handleTermsPress = () => {
    router.push('/(legal)/terms');
  };

  const handlePrivacyPress = () => {
    router.push('/(legal)/privacy');
  };

  async function handleGoogleSignUp() {
    setLoading(true);
    try {
      const { data, error, googleUserInfo } = await signInWithGoogle();
      
      if (error) {
        showError(error.message || 'Failed to sign in with Google');
        return;
      }

      if (data?.user) {
        // Create or update profile with Google avatar
        await createProfileWithGoogleAvatar(data.user, googleUserInfo);
      }
    } catch (error: any) {
      showError(error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithEmail() {
    Keyboard.dismiss();
    if (password !== confirmPassword) {
      showError("Passwords do not match");
      return;
    }

    if (email && password && confirmPassword) {
      setLoading(true)
      const {
        data: { user, session },
        error,
      } = await supabase.auth.signUp({
        email: email,
        password: password,
      });
  
      if (error) {
        showError(error.message);
        setLoading(false);
        return;
      }
      if (user && user.identities && user.identities.length === 0) {
        showError('This email is already registered');
        setLoading(false);
        return;
      }
      if (!session) {
        router.replace({
          pathname: "/(auth)/verification",
          params: { email: email }
        });
      }
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
      backgroundColor: (email && password && confirmPassword) ? colors.brand : colors.secondaryAccent,
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
    }
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
          (loading || !email || !password || !confirmPassword) && styles.signUpButtonDisabled
        ]}
        onPress={signUpWithEmail}
        disabled={loading || !email || !password || !confirmPassword}
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