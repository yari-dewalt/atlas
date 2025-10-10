import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useOnboardingStore } from '../../stores/onboardingStore';

type WeightUnit = 'lbs' | 'kg';
type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export default function PersonalInfo() {
  const router = useRouter();
  const { session, fetchProfile } = useAuthStore();
  const { setInOnboardingFlow } = useOnboardingStore();
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  
  // New fields
  const [selectedWeightUnit, setSelectedWeightUnit] = useState<WeightUnit | null>(null);
  const [selectedExperience, setSelectedExperience] = useState<ExperienceLevel | null>(null);

  // Date picker state
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [showAndroidDatePicker, setShowAndroidDatePicker] = useState(false);
  const datePickerBottomSheetRef = useRef<BottomSheet>(null);
  const datePickerSnapPoints = useMemo(() => ['40%'], []);

  // Check if required fields are filled
  const isFormValid = selectedWeightUnit && selectedExperience;

  // Weight unit options
  const weightOptions = [
    { value: 'lbs' as WeightUnit, label: 'Pounds (lbs)', description: 'Standard in US and UK' },
    { value: 'kg' as WeightUnit, label: 'Kilograms (kg)', description: 'Metric system standard' },
  ];

  // Experience level options
  const experienceOptions = [
    { value: 'beginner' as ExperienceLevel, label: 'Beginner', description: 'New to working out' },
    { value: 'intermediate' as ExperienceLevel, label: 'Intermediate', description: 'Some experience' },
    { value: 'advanced' as ExperienceLevel, label: 'Advanced', description: 'Regular lifter' },
  ];  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowAndroidDatePicker(false);
      if (event.type === 'set' && selectedDate) {
        setDateOfBirth(selectedDate);
      }
      // Close the bottom sheet after handling the date
      datePickerBottomSheetRef.current?.close();
    } else {
      // iOS behavior
      if (selectedDate) {
        setDateOfBirth(selectedDate);
      }
    }
  };

  const handleDatePickerSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      setDatePickerVisible(false);
      setShowAndroidDatePicker(false);
    }
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    []
  );

  const handleDatePress = () => {
    setDatePickerVisible(true);
    datePickerBottomSheetRef.current?.expand();
    // Small delay to ensure bottom sheet is open before showing Android picker
    if (Platform.OS === 'android') {
      setTimeout(() => {
        setShowAndroidDatePicker(true);
      }, 100);
    }
  };

  const handleContinue = async () => {
    if (!session?.user) {
      Alert.alert('Error', 'No user session found');
      return;
    }

    setLoading(true);
    try {
      // Set that we're actively in the onboarding flow
      setInOnboardingFlow(true);
      
      const updateData: any = {
        id: session.user.id,
        updated_at: new Date().toISOString(),
        weight_unit: selectedWeightUnit,
      };

      // Only add fields if they have values
      if (fullName.trim()) {
        updateData.name = fullName.trim();
      }

      if (dateOfBirth) {
        updateData.date_of_birth = dateOfBirth.toISOString().split('T')[0]; // YYYY-MM-DD format
      }

      updateData.workout_experience = selectedExperience;

      const { error } = await supabase
        .from('profiles')
        .upsert(updateData);

      if (error) throw error;
      
      router.push('/(onboarding)/complete');
    } catch (error) {
      console.error('Error updating personal info:', error);
      Alert.alert('Error', 'Failed to save information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/(onboarding)/complete');
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <GestureHandlerRootView style={styles.gestureHandlerRoot}>
    <SafeAreaView style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={() => router.dismissTo('/(onboarding)/username')} style={styles.progressSection}>
          <Text style={styles.progressLabel}>Username</Text>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} style={styles.checkmark} />
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} style={styles.chevron} />
        <View style={styles.progressSection}>
          <Text style={[styles.progressLabel, styles.activeLabel]}>Personal Info</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} style={styles.chevron} />
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>Get Started</Text>
        </View>
      </View>

      <View 
        style={styles.scrollContent} 
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Personal Information</Text>
              <Text style={styles.subtitle}>
                Help us personalize your experience
              </Text>
            </View>

            {/* Weight Unit Section */}
            <View style={styles.section}>
              <Text style={styles.inputLabel}>Weight Unit</Text>
              
              <View style={styles.buttonRow}>
                {weightOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.minimalistButton,
                      selectedWeightUnit === option.value && styles.minimalistButtonSelected,
                    ]}
                    onPress={() => setSelectedWeightUnit(option.value)}
                  >
                    <Text style={[
                      styles.minimalistButtonText,
                      selectedWeightUnit === option.value && styles.minimalistButtonTextSelected,
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Workout Experience Section */}
            <View style={styles.section}>
              <Text style={styles.inputLabel}>Workout Experience</Text>
              
              <View style={styles.buttonRow}>
                {experienceOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.minimalistButton,
                      selectedExperience === option.value && styles.minimalistButtonSelected,
                    ]}
                    onPress={() => setSelectedExperience(option.value)}
                  >
                    <Text style={[
                      styles.minimalistButtonText,
                      selectedExperience === option.value && styles.minimalistButtonTextSelected,
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Personal Info Form */}
            <View style={styles.section}>
              {/* Full Name */}
              <View style={styles.inputContainer}>
                <View style={styles.labelContainer}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <Text style={styles.optionalLabel}>optional</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter your full name"
                  placeholderTextColor={colors.secondaryText}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              {/* Date of Birth */}
              <View style={styles.inputContainer}>
                <View style={styles.labelContainer}>
                  <Text style={styles.inputLabel}>Date of Birth</Text>
                  <Text style={styles.optionalLabel}>optional</Text>
                </View>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={handleDatePress}
                >
                  <Text style={[
                    styles.dateText,
                    !dateOfBirth && styles.placeholderText
                  ]}>
                    {dateOfBirth ? formatDate(dateOfBirth) : 'Select your date of birth'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[
              styles.continueButton, 
              (loading || !isFormValid) && styles.disabledButton
            ]}
            onPress={handleContinue}
            disabled={loading || !isFormValid}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <>
                <Text style={styles.continueButtonText}>Continue</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

      {/* Date Picker Bottom Sheet */}
      <BottomSheet
        ref={datePickerBottomSheetRef}
        index={-1}
        snapPoints={datePickerSnapPoints}
        onChange={handleDatePickerSheetChanges}
        enablePanDownToClose={true}
        backgroundStyle={[styles.bottomSheetBackground, Platform.OS === 'android' && { opacity: 0 }]}
        handleIndicatorStyle={[styles.bottomSheetIndicator, Platform.OS === 'android' && { opacity: 0 }]}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={[styles.datePickerModalContent, Platform.OS === 'android' && { opacity: 0 }]}>
          <Text style={styles.datePickerTitle}>Select Date of Birth</Text>
          <Text style={styles.datePickerSubtitle}>
            Choose your date of birth
          </Text>
          
          <View style={styles.datePickerContent}>
            {(Platform.OS === 'ios' || showAndroidDatePicker) && (
              <DateTimePicker
                value={dateOfBirth || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
                style={styles.datePicker}
              />
            )}
            {Platform.OS === 'android' && !showAndroidDatePicker && (
              <TouchableOpacity
                style={styles.androidDateButton}
                onPress={() => setShowAndroidDatePicker(true)}
              >
                <Text style={styles.androidDateButtonText}>
                  {dateOfBirth ? formatDate(dateOfBirth) : 'Select Date'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </BottomSheetView>
      </BottomSheet>

    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureHandlerRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
  },
  progressSection: {
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    color: colors.secondaryText,
    textAlign: 'center',
  },
  activeLabel: {
    color: colors.brand,
    fontWeight: '500',
  },
  checkmark: {
    position: 'absolute',
    top: 18,
  },
  chevron: {
    marginHorizontal: 8,
    opacity: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '500',
    color: colors.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.secondaryText,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.primaryText,
    backgroundColor: colors.background,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  dateText: {
    fontSize: 16,
    color: colors.primaryText,
  },
  placeholderText: {
    color: colors.secondaryText,
  },
  // BottomSheet styles
  bottomSheetBackground: {
    backgroundColor: colors.primaryAccent,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  bottomSheetIndicator: {
    backgroundColor: colors.secondaryText,
    width: 50,
  },
  datePickerModalContent: {
    padding: 20,
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  datePickerSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
    paddingBottom: 12,
  },
  datePickerContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  datePicker: {
    backgroundColor: colors.primaryAccent,
  },
  androidDateButton: {
    backgroundColor: colors.brand,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  androidDateButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: colors.brand,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primaryText,
  },
  disabledButton: {
    opacity: 0.5,
  },
  // New styles for consolidated form
  section: {
    marginBottom: 32,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  // New minimalist button styles
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  minimalistButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  minimalistButtonSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  minimalistButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primaryText,
  },
  minimalistButtonTextSelected: {
    color: colors.primaryText,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  optionalLabel: {
    fontSize: 12,
    fontWeight: '300',
    color: colors.secondaryText,
    fontStyle: 'italic',
  },
});
