import { View, Text, StyleSheet, TextInput, Pressable, TouchableOpacity, Keyboard, TouchableWithoutFeedback, ActivityIndicator, Animated, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useState, useEffect, useRef } from 'react';

export default function Verification() {
  const router = useRouter();
  const { email, isSignup, isPasswordReset } = useLocalSearchParams();
  const { markEmailVerified } = useAuthStore();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const hiddenInputRef = useRef<TextInput>(null);
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  
  const isSignupFlow = isSignup === 'true';
  const isPasswordResetFlow = isPasswordReset === 'true';

  // Note: We don't automatically send OTP here anymore since it's sent from the login/signup flows
  // Users can manually request a new code using the "Resend Code" button if needed

  // Animate cursor blinking
  useEffect(() => {
    const blinkCursor = () => {
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: 530,
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 530,
          useNativeDriver: true,
        }),
      ]).start(blinkCursor);
    };

    // Only animate if input is focused and we haven't completed all 6 digits
    if (isInputFocused && otp.length < 6) {
      blinkCursor();
    }

    return () => {
      cursorOpacity.stopAnimation();
    };
  }, [otp.length, cursorOpacity, isInputFocused]);

    const handleVerifyOtp = async () => {
    // Clear any previous error messages
    setErrorMessage('');
    
    if (!otp || otp.length !== 6) {
      setErrorMessage('Please enter a valid 6-digit code');
      return;
    }

    if (!email) {
      setErrorMessage('Email is required');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email as string,
        token: otp,
        type: 'email'
      });

      if (error) {
        // Check if it's an invalid token error
        if (error.message.toLowerCase().includes('invalid') || 
            error.message.toLowerCase().includes('token') ||
            error.message.toLowerCase().includes('code')) {
          setErrorMessage('Incorrect verification code. Please try again.');
        } else {
          setErrorMessage(error.message);
        }
        setLoading(false);
        return;
      }

      if (data.user && data.session) {
        if (isPasswordResetFlow) {
          // For password reset, we don't want to keep the session active
          // The session will be used to update password in the next screen
          router.replace({
            pathname: '/(auth)/newPassword',
            params: { email: email }
          });
        } else {
          // For signup/login flows, update email verification status
          try {
            await markEmailVerified();
            
            // Give a small delay to ensure the profile state is updated
            // before the _layout routing logic runs
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // User is now logged in, redirect appropriately
            if (isSignupFlow) {
              // New user - go to onboarding
              router.replace('/(onboarding)/welcome');
            } else {
              // Existing user verifying email - go to main app
              router.replace('/(app)/(tabs)/home');
            }
          } catch (error) {
            console.error('Error updating email verification status:', error);
            // Don't block the user, but log the error
          }
        }
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email) return;
    
    setResendLoading(true);
    setErrorMessage(''); // Clear any error messages
    
    const { error } = await supabase.auth.signInWithOtp({
      email: email as string,
      options: {
        shouldCreateUser: false, // User already exists
      }
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Verification code sent!');
    }
    setResendLoading(false);
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
        
        <Text style={styles.title}>
          {isPasswordResetFlow ? 'Reset Password' : 'Verify Your Email'}
        </Text>
        <Text style={styles.text}>
          We've sent a 6-digit verification code to:
        </Text>
        <Text style={styles.emailText}>{email}</Text>
        <Text style={styles.text}>
          {isPasswordResetFlow 
            ? 'Enter the code below to reset your password.'
            : 'Enter the code below to verify your email and continue.'
          }
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputName}>Verification Code</Text>
          
          {/* OTP Display Boxes */}
          <TouchableOpacity 
            style={styles.otpContainer}
            activeOpacity={1}
            onPress={() => {
              // Focus the hidden input when user taps on OTP boxes
              hiddenInputRef.current?.focus();
            }}
          >
            {Array.from({ length: 6 }, (_, index) => (
              <View 
                key={index} 
                style={[
                  styles.otpBox,
                  otp.length > index && styles.otpBoxFilled,
                  otp.length === index && styles.otpBoxActive
                ]}
              >
                <View style={styles.otpBoxContent}>
                  <Text style={[
                    styles.otpText,
                    otp.length > index && styles.otpTextFilled
                  ]}>
                    {otp[index] || ''}
                  </Text>
                  {/* Show cursor in active box when empty and input is focused */}
                  {otp.length === index && !otp[index] && isInputFocused && (
                    <Animated.View 
                      style={[
                        styles.cursor,
                        { opacity: cursorOpacity }
                      ]} 
                    />
                  )}
                </View>
              </View>
            ))}
          </TouchableOpacity>
          
          {/* Hidden Input Field */}
          <TextInput
            ref={hiddenInputRef}
            style={styles.hiddenInput}
            onChangeText={(text) => {
              setOtp(text);
              // Clear error message when user starts typing
              if (errorMessage) {
                setErrorMessage('');
              }
            }}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            value={otp}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus={true}
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
          />
        </View>

        {/* Error Message */}
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.5} 
          style={[
            styles.verifyButton,
            (loading || !otp || otp.length !== 6) && styles.verifyButtonDisabled
          ]}
          onPress={handleVerifyOtp}
          disabled={loading || !otp || otp.length !== 6}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.verifyButtonText}>
              {isPasswordResetFlow ? 'Continue' : 'Verify & Log In'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.5} 
          style={styles.resendButton}
          onPress={handleResendOtp}
          disabled={resendLoading}
        >
          {resendLoading ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <Text style={styles.resendButtonText}>Resend Code</Text>
          )}
        </TouchableOpacity>
        
        <Text style={styles.noteText}>
          Didn't receive the code? Check your spam folder or tap "Resend Code" above.
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
    textAlign: 'center',
  },
  emailText: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  noteText: {
    color: colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 'auto',
    marginBottom: 40,
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
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  otpBox: {
    width: 45,
    height: 55,
    borderWidth: 2,
    borderColor: colors.secondaryAccent,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  otpBoxContent: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  otpBoxFilled: {
    borderColor: colors.primaryText,
    backgroundColor: colors.background,
  },
  otpBoxActive: {
    borderColor: colors.brand,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  otpText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.secondaryText,
  },
  otpTextFilled: {
    color: colors.primaryText,
  },
  cursor: {
    position: 'absolute',
    width: 2,
    height: 24,
    backgroundColor: colors.secondaryText,
    borderRadius: 1,
  },
  errorText: {
    color: colors.notification,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  verifyButton: {
    backgroundColor: colors.brand,
    color: colors.primaryText,
    width: '100%',
    height: 48,
    borderRadius: 8,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  verifyButtonDisabled: {
    backgroundColor: colors.secondaryAccent,
    opacity: 0.7,
  },
  verifyButtonText: {
    color: colors.primaryText,
    fontWeight: 'bold',
    fontSize: 16,
  },
  resendButton: {
    backgroundColor: colors.background,
    color: colors.primaryText,
    height: 48,
    borderRadius: 8,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendButtonText: {
    color: colors.brand,
    fontWeight: '500',
    fontSize: 15,
  },
});