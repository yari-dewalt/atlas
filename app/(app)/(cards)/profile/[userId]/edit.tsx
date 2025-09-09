import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, ScrollView, Alert, Image, Animated, TouchableOpacity, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { colors } from '../../../../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../../../../stores/authStore';
import { useProfileStore } from '../../../../../stores/profileStore';
import { useEditProfileStore } from '../../../../../stores/editProfileStore';
import CachedAvatar from '../../../../../components/CachedAvatar';
import { supabase } from '../../../../../lib/supabase';

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile: authProfile, session, updateProfile } = useAuthStore();
  const { currentProfile, updateCurrentProfile } = useProfileStore();
  const { setEditProfileState, resetEditProfileState } = useEditProfileStore();
  
  // Form state
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Original values for change detection
  const [originalName, setOriginalName] = useState('');
  const [originalBio, setOriginalBio] = useState('');
  const [originalAvatarUrl, setOriginalAvatarUrl] = useState<string | null>(null);
  const [originalWeightUnit, setOriginalWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [originalDateOfBirth, setOriginalDateOfBirth] = useState<Date | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  
  // Bottom sheet state
  const [photoOptionsVisible, setPhotoOptionsVisible] = useState(false);
  const photoOptionsBottomSheetRef = useRef<BottomSheet>(null);
  const photoOptionsSnapPoints = useMemo(() => ['25%'], []);
  
  const [weightUnitOptionsVisible, setWeightUnitOptionsVisible] = useState(false);
  const weightUnitOptionsBottomSheetRef = useRef<BottomSheet>(null);
  const weightUnitOptionsSnapPoints = useMemo(() => ['25%'], []);
  
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [showAndroidDatePicker, setShowAndroidDatePicker] = useState(false);
  const datePickerBottomSheetRef = useRef<BottomSheet>(null);
  const datePickerSnapPoints = useMemo(() => ['40%'], []);
  
  useEffect(() => {
    // Initialize form with current profile data
    if (currentProfile) {
      const profileName = currentProfile.name || '';
      const profileBio = currentProfile.bio || '';
      const profileAvatarUrl = currentProfile.avatar_url;
      const profileWeightUnit = currentProfile.weight_unit || 'lbs';
      const profileDateOfBirth = currentProfile.date_of_birth ? new Date(currentProfile.date_of_birth) : null;
      
      setName(profileName);
      setBio(profileBio);
      setAvatarUrl(profileAvatarUrl);
      setWeightUnit(profileWeightUnit);
      setDateOfBirth(profileDateOfBirth);
      
      // Store original values
      setOriginalName(profileName);
      setOriginalBio(profileBio);
      setOriginalAvatarUrl(profileAvatarUrl);
      setOriginalWeightUnit(profileWeightUnit);
      setOriginalDateOfBirth(profileDateOfBirth);
    }
  }, [currentProfile]);

  // Check if any changes have been made
  const hasChanges = useMemo(() => {
    return (
      name !== originalName ||
      bio !== originalBio ||
      avatarUrl !== originalAvatarUrl ||
      weightUnit !== originalWeightUnit ||
      dateOfBirth?.getTime() !== originalDateOfBirth?.getTime()
    );
  }, [name, originalName, bio, originalBio, avatarUrl, originalAvatarUrl, weightUnit, originalWeightUnit, dateOfBirth, originalDateOfBirth]);

  const handleSave = useCallback(async () => {
    // Don't save if no changes
    if (!hasChanges) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Update profile in database
      const { error } = await supabase
        .from('profiles')
        .update({
          name: name,
          bio: bio,
          avatar_url: avatarUrl,
          weight_unit: weightUnit,
          date_of_birth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', authProfile?.id);
        
      if (error) throw error;
      
      // Update local state
      if (updateProfile) {
        updateProfile({
          ...authProfile!,
          name,
          bio,
          avatar_url: avatarUrl,
          weight_unit: weightUnit,
          date_of_birth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : null,
        });
      }

      // Also update the profile store if this is the current profile being viewed
      if (updateCurrentProfile) {
        updateCurrentProfile({
          name,
          bio,
          avatar_url: avatarUrl,
          weight_unit: weightUnit,
          date_of_birth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : null,
        });
      }
      
      // Navigate back on success
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Update Failed', 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [hasChanges, name, bio, avatarUrl, weightUnit, authProfile, updateProfile, updateCurrentProfile, router]);

  // Update layout store when form state changes
  useEffect(() => {
    console.log('Edit Profile State Update:', { hasChanges, isValid: true, isLoading: loading });
    setEditProfileState({
      hasChanges,
      isValid: true,
      isLoading: loading,
      handleSave
    });
  }, [hasChanges, loading, handleSave, setEditProfileState]);

  // Reset store when component unmounts
  useEffect(() => {
    return () => {
      resetEditProfileState();
    };
  }, [resetEditProfileState]);

  // Bottom Sheet callbacks
  const handlePhotoOptionsSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      setPhotoOptionsVisible(false);
    }
  }, []);

  const handleWeightUnitOptionsSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      setWeightUnitOptionsVisible(false);
    }
  }, []);

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

  const handleChangePhotoPress = () => {
    setPhotoOptionsVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    photoOptionsBottomSheetRef.current?.expand();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleChangeWeightUnitPress = () => {
    setWeightUnitOptionsVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    weightUnitOptionsBottomSheetRef.current?.expand();
  };

  const handleDatePress = () => {
    setDatePickerVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    datePickerBottomSheetRef.current?.expand();
    // Small delay to ensure bottom sheet is open before showing Android picker
    if (Platform.OS === 'android') {
      setTimeout(() => {
        setShowAndroidDatePicker(true);
      }, 100);
    }
  };

  const selectFromLibrary = async () => {
    photoOptionsBottomSheetRef.current?.close();
    await uploadAvatar('library');
  };

  const takePhoto = async () => {
    photoOptionsBottomSheetRef.current?.close();
    
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access to take photos.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    await uploadAvatar('camera');
  };

  const deleteProfilePicture = () => {
    photoOptionsBottomSheetRef.current?.close();
    setAvatarUrl(null);
  };

  const selectLbs = () => {
    weightUnitOptionsBottomSheetRef.current?.close();
    setWeightUnit('lbs');
  };

  const selectKg = () => {
    weightUnitOptionsBottomSheetRef.current?.close();
    setWeightUnit('kg');
  };

  async function uploadAvatar(source: 'camera' | 'library' = 'library') {
      try {
        setUploading(true);
  
        let result;
        if (source === 'camera') {
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            quality: 1,
            exif: false,
          });
        } else {
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images', // Restrict to only images
            allowsMultipleSelection: false, // Can only select one image
            allowsEditing: true, // Allows the user to crop / rotate their photo before uploading it
            quality: 1,
            exif: false, // We don't want nor need that data.
          });
        }
  
        if (result.canceled || !result.assets || result.assets.length === 0) {
          console.log("User cancelled image picker.");
          return;
        }
  
        const image = result.assets[0];
        console.log("Got image", image);
  
        if (!image.uri) {
          throw new Error("No image uri!"); // Realistically, this should never happen, but just in case...
        }
  
        const arraybuffer = await fetch(image.uri).then((res) =>
          res.arrayBuffer(),
        );
  
        const fileExt = image.uri?.split(".").pop()?.toLowerCase() ?? "jpeg";
        const path = `${Date.now()}.${fileExt}`;
        const { data, error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, arraybuffer, {
            contentType: image.mimeType ?? "image/jpeg",
          });
  
        if (uploadError) {
          throw uploadError;
        }
  
        setAvatarUrl(data.path);
      } catch (error) {
        if (error instanceof Error) {
          Alert.alert(error.message);
        } else {
          throw error;
        }
      } finally {
        setUploading(false);
      }
    }

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView style={styles.contentContainer} contentContainerStyle={styles.scrollContent}>
        <View style={styles.avatarContainer}>
          {uploading ? (
            <View style={[styles.avatar, styles.avatarLoading]}>
            </View>
          ) : (
            <CachedAvatar
              path={avatarUrl}
              size={100}
              style={styles.avatar}
              fallbackIconName="person-circle"
              fallbackIconColor={colors.secondaryText}
            />
          )}
          
          <TouchableOpacity
                activeOpacity={0.5} 
            style={[
              styles.changePictureButton,
              uploading && styles.disabledButton
            ]} 
            onPress={handleChangePhotoPress}
            disabled={uploading}
          >
            <Text style={styles.changePictureText}>Change Picture</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.formContainer}>
          <Text style={styles.formHeaderText}>Public profile data</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={colors.placeholderText}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Birthday</Text>
            <TouchableOpacity
              style={styles.dateSelector}
              onPress={handleDatePress}
            >
              <Text style={[
                styles.dateSelectorText,
                !dateOfBirth && styles.placeholderText
              ]}>
                {dateOfBirth ? formatDate(dateOfBirth) : 'Select your date of birth'}
              </Text>
              <Ionicons name="calendar-outline" size={16} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.formHeaderText}>App preferences</Text>
          
          <View style={[styles.formGroup, styles.lastFormGroup]}>
            <Text style={styles.label}>Weight Unit</Text>
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.unitSelector}
              onPress={handleChangeWeightUnitPress}
            >
              <Text style={styles.unitSelectorText}>{weightUnit.toLowerCase()}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Photo Options Bottom Sheet */}
      <BottomSheet
        ref={photoOptionsBottomSheetRef}
        index={-1}
        snapPoints={photoOptionsSnapPoints}
        onChange={handlePhotoOptionsSheetChanges}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.photoOptionsModalContent}>
          <Text style={styles.photoOptionsTitle}>Change Profile Picture</Text>
          <Text style={styles.photoOptionsSubtitle}>
            Choose an option for your profile picture
          </Text>
          
          <View style={styles.photoOptionsContent}>
            <TouchableOpacity
                activeOpacity={0.5} style={styles.photoOptionItem} onPress={takePhoto}>
              <View style={styles.photoOptionIcon}>
                <Ionicons name="camera-outline" size={24} color={colors.primaryText} />
              </View>
              <View style={styles.photoOptionTextContainer}>
                <Text style={styles.photoOptionTitle}>Take Photo</Text>
                <Text style={styles.photoOptionDescription}>Use your camera to take a new photo</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
            </TouchableOpacity>

            <TouchableOpacity
                activeOpacity={0.5} style={styles.photoOptionItem} onPress={selectFromLibrary}>
              <View style={styles.photoOptionIcon}>
                <Ionicons name="image-outline" size={24} color={colors.primaryText} />
              </View>
              <View style={styles.photoOptionTextContainer}>
                <Text style={styles.photoOptionTitle}>Choose from Library</Text>
                <Text style={styles.photoOptionDescription}>Select a photo from your gallery</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
            </TouchableOpacity>

            {avatarUrl && (
              <TouchableOpacity
                activeOpacity={0.5} style={[styles.photoOptionItem, styles.destructiveOption]} onPress={deleteProfilePicture}>
                <View style={styles.photoOptionIcon}>
                  <Ionicons name="trash-outline" size={24} color={colors.notification} />
                </View>
                <View style={styles.photoOptionTextContainer}>
                  <Text style={[styles.photoOptionTitle, styles.destructiveText]}>Delete Picture</Text>
                  <Text style={styles.photoOptionDescription}>Remove your current profile picture</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.notification} />
              </TouchableOpacity>
            )}
          </View>
        </BottomSheetView>
      </BottomSheet>

      {/* Weight Unit Options Bottom Sheet */}
      <BottomSheet
        ref={weightUnitOptionsBottomSheetRef}
        index={-1}
        snapPoints={weightUnitOptionsSnapPoints}
        onChange={handleWeightUnitOptionsSheetChanges}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.photoOptionsModalContent}>
          <Text style={styles.photoOptionsTitle}>Weight Unit</Text>
          <Text style={styles.photoOptionsSubtitle}>
            Choose your preferred weight unit for workouts
          </Text>
          
          <View style={styles.photoOptionsContent}>
            <TouchableOpacity
                activeOpacity={0.5} style={styles.photoOptionItem} onPress={selectLbs}>
              <View style={styles.photoOptionIcon}>
                <Ionicons name="barbell-outline" size={24} color={colors.primaryText} />
              </View>
              <View style={styles.photoOptionTextContainer}>
                <Text style={styles.photoOptionTitle}>Pounds (lbs)</Text>
                <Text style={styles.photoOptionDescription}>Imperial weight system</Text>
              </View>
              {weightUnit === 'lbs' && (
                <Ionicons name="checkmark" size={20} color={colors.brand} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
                activeOpacity={0.5} style={styles.photoOptionItem} onPress={selectKg}>
              <View style={styles.photoOptionIcon}>
                <Ionicons name="barbell-outline" size={24} color={colors.primaryText} />
              </View>
              <View style={styles.photoOptionTextContainer}>
                <Text style={styles.photoOptionTitle}>Kilograms (kg)</Text>
                <Text style={styles.photoOptionDescription}>Metric weight system</Text>
              </View>
              {weightUnit === 'kg' && (
                <Ionicons name="checkmark" size={20} color={colors.brand} />
              )}
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>

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
        <BottomSheetView style={[styles.photoOptionsModalContent, Platform.OS === 'android' && { opacity: 0 }]}>
          <Text style={styles.photoOptionsTitle}>Select Date of Birth</Text>
          <Text style={styles.photoOptionsSubtitle}>
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

      {loading && (
        <View style={styles.loadingOverlay}>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  changePictureButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  changePictureText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.brand,
  },
  formContainer: {
    marginTop: 32,
  },
  formHeaderText: {
    fontSize: 16,
    color: colors.secondaryText,
    marginBottom: 12,
  },
  formGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlayLight,
  },
  lastFormGroup: {
    borderBottomWidth: 0,
  },
  label: {
    fontSize: 16,
    color: colors.primaryText,
    marginRight: 16,
    width: '25%',
  },
  input: {
    flex: 1,
    borderRadius: 0,
    padding: 0,
    fontSize: 16,
    color: colors.primaryText,
  },
  unitSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    paddingVertical: 4,
  },
  unitSelectorText: {
    fontSize: 16,
    color: colors.primaryText,
    fontWeight: '400',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    paddingVertical: 4,
  },
  dateSelectorText: {
    fontSize: 16,
    color: colors.primaryText,
    fontWeight: '400',
  },
  placeholderText: {
    color: colors.secondaryText,
  },
  disabledButton: {
    opacity: 0.5,
  },
  avatarLoading: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.secondaryAccent,
  },
  bottomSheetBackground: {
    backgroundColor: colors.primaryAccent,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  bottomSheetIndicator: {
    backgroundColor: colors.secondaryText,
    width: 50,
  },
  photoOptionsModalContent: {
    padding: 20,
  },
  photoOptionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  photoOptionsSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
    paddingBottom: 12,
  },
  photoOptionsContent: {
    gap: 16,
  },
  photoOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlayLight,
  },
  photoOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.whiteOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  photoOptionTextContainer: {
    flex: 1,
  },
  photoOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 2,
  },
  photoOptionDescription: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  destructiveOption: {
  },
  destructiveText: {
    color: colors.notification,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  datePicker: {
    backgroundColor: colors.primaryAccent,
  },
  datePickerContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
});