import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  Alert,
  Vibration,
  TouchableOpacity,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../../constants/colors';
import { useWorkoutStore } from '../../../stores/workoutStore';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, BottomSheetView } from "@gorhom/bottom-sheet";
import { useRef, useMemo, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

export default function WorkoutSettings() {
  const router = useRouter();
  const { workoutSettings, updateWorkoutSettings, loadWorkoutSettings } = useWorkoutStore();

  // Local state that syncs with store
  const [settings, setSettings] = useState(workoutSettings);

  const timerSoundBottomSheetRef = useRef(null);
  const [timerSoundModalVisible, setTimerSoundModalVisible] = useState(false);

  const timerSoundSnapPoints = useMemo(() => ['40%'], []);

// Add timer sound options
const timerSoundOptions = [
  { value: 'bell', label: 'Bell', description: 'Classic timer completion sound' },
  { value: 'none', label: 'None', description: 'Silent notification' },
];

const handleTimerSoundSheetChanges = useCallback((index) => {
  if (index === -1) {
    setTimerSoundModalVisible(false);
  }
}, []);

const openTimerSoundModal = () => {
  setTimerSoundModalVisible(true);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  timerSoundBottomSheetRef.current?.expand();
};

// Function to play sound preview
const playTimerSoundPreview = async (soundType) => {
  try {
    switch (soundType) {
      case 'bell':
        // Play the actual timercomplete.mp3 sound
        const { sound } = await Audio.Sound.createAsync(
          require('../../../assets/sounds/timercomplete.mp3'),
          { shouldPlay: true, volume: 0.8 }
        );
        // Unload after playing
        setTimeout(() => {
          sound.unloadAsync();
        }, 3000);
        break;
        
      case 'none':
        break;
        
      default:
        break;
    }
  } catch (error) {
    console.log('Error playing sound preview:', error);
    // For sound preview errors, we can give minimal feedback
    try {
      await Haptics.selectionAsync();
    } catch (hapticError) {
      // Completely silent fallback
    }
  }
};

const selectTimerSound = async (soundOption) => {
  // Play preview of selected sound
  await playTimerSoundPreview(soundOption.value);
  
  // Update setting
  updateSetting('timerSound', soundOption.value);
  
  // Close bottom sheet after a short delay to let the sound play
  setTimeout(() => {
    timerSoundBottomSheetRef.current?.close();
  }, 300);
};

const renderBackdrop = useCallback(
  (props) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      enableTouchThrough={false}
      onPress={() => {
        timerSoundBottomSheetRef.current?.close();
      }}
    />
  ),
  []
);

  useEffect(() => {
    loadWorkoutSettings();
  }, []);

  useEffect(() => {
    // Update local state when store settings change
    setSettings(workoutSettings);
  }, [workoutSettings]);

  // Auto-save function that updates both local state and store
  const updateSetting = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await updateWorkoutSettings({ [key]: value });
  };

const ToggleSettingItem = ({ title, subtitle, settingKey }) => (
  <View style={styles.settingItem}>
    <View style={styles.settingContent}>
      <Text style={styles.settingTitle}>{title}</Text>
      {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
    </View>
    <Switch
      value={settings[settingKey]}
      onValueChange={(value) => updateSetting(settingKey, value)}
      trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.brand }}
      thumbColor={settings[settingKey] ? colors.primaryText : 'rgba(255,255,255,0.8)'}
    />
  </View>
);

  const NavigableSettingItem = ({ title, subtitle, value, onPress, showChevron = true }) => (
    <TouchableOpacity
                activeOpacity={0.5} style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        {value && <Text style={styles.settingValue}>{value}</Text>}
      </View>
      {showChevron && (
        <IonIcon name="chevron-forward" size={20} color={colors.secondaryText} />
      )}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

// Update your return statement to wrap everything in GestureHandlerRootView
return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Workout Settings</Text>
        <TouchableOpacity
                activeOpacity={0.5} onPress={() => router.back()} style={styles.headerButton}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Timer Settings */}
        <SectionHeader title="Timer Settings" />
        <View style={styles.section}>
          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Default Rest Timer</Text>
              <View style={styles.simpleTimeInputContainer}>
                <TextInput
                  style={styles.simpleTimeInput}
                  value={settings.defaultRestMinutes.toString()}
                  onChangeText={(value) => updateSetting('defaultRestMinutes', parseInt(value) || 0)}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="2"
                  placeholderTextColor={colors.secondaryText}
                />
                <Text style={styles.timeUnit}>min</Text>
                <TextInput
                  style={styles.simpleTimeInput}
                  value={settings.defaultRestSeconds.toString()}
                  onChangeText={(value) => updateSetting('defaultRestSeconds', parseInt(value) || 0)}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="0"
                  placeholderTextColor={colors.secondaryText}
                />
                <Text style={styles.timeUnit}>sec</Text>
              </View>
            </View>
          </View>

          <NavigableSettingItem
            title="Timer Sound"
            subtitle={timerSoundOptions.find(option => option.value === settings.timerSound)?.label || 'Bell'}
            onPress={openTimerSoundModal}
          />

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Vibration</Text>
              <Text style={styles.settingSubtitle}>Vibrate when rest timer completes</Text>
            </View>
            <Switch
              value={settings.vibrationEnabled}
              onValueChange={(value) => updateSetting('vibrationEnabled', value)}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.brand }}
              thumbColor={settings.vibrationEnabled ? colors.primaryText : 'rgba(255,255,255,0.8)'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Auto-start Timer</Text>
              <Text style={styles.settingSubtitle}>Automatically start workout duration timer</Text>
            </View>
            <Switch
              value={settings.autoStartTimer}
              onValueChange={(value) => updateSetting('autoStartTimer', value)}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.brand }}
              thumbColor={settings.autoStartTimer ? colors.primaryText : 'rgba(255,255,255,0.8)'}
            />
          </View>
        </View>

        {/* Display Settings */}
        <SectionHeader title="Display" />
        <View style={styles.section}>
          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Show Floating Timer</Text>
              <Text style={styles.settingSubtitle}>Show floating timer ribbon after scrolling</Text>
            </View>
            <Switch
              value={settings.showElapsedTime}
              onValueChange={(value) => updateSetting('showElapsedTime', value)}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.brand }}
              thumbColor={settings.showElapsedTime ? colors.primaryText : 'rgba(255,255,255,0.8)'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Keep Screen On</Text>
              <Text style={styles.settingSubtitle}>Prevent screen from turning off during workout</Text>
            </View>
            <Switch
              value={settings.keepScreenOn}
              onValueChange={(value) => updateSetting('keepScreenOn', value)}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.brand }}
              thumbColor={settings.keepScreenOn ? colors.primaryText : 'rgba(255,255,255,0.8)'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Large Timer Display</Text>
              <Text style={styles.settingSubtitle}>Use bigger timer text for better visibility</Text>
            </View>
            <Switch
              value={settings.largeTimerDisplay}
              onValueChange={(value) => updateSetting('largeTimerDisplay', value)}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.brand }}
              thumbColor={settings.largeTimerDisplay ? colors.primaryText : 'rgba(255,255,255,0.8)'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Show Active Workout Banner</Text>
              <Text style={styles.settingSubtitle}>Display in progress workout at the bottom of the screen</Text>
            </View>
            <Switch
              value={settings.showActiveWorkoutBanner}
              onValueChange={(value) => updateSetting('showActiveWorkoutBanner', value)}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.brand }}
              thumbColor={settings.showActiveWorkoutBanner ? colors.primaryText : 'rgba(255,255,255,0.8)'}
            />
          </View>
        </View>

        {/* Workout Behavior */}
        <SectionHeader title="Workout Behavior" />
        <View style={styles.section}>
          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Rate of Perceived Exertion (RPE)</Text>
              <Text style={styles.settingSubtitle}>Enable RPE tracking</Text>
            </View>
            <Switch
              value={settings.rpeEnabled}
              onValueChange={(value) => updateSetting('rpeEnabled', value)}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.brand }}
              thumbColor={settings.rpeEnabled ? colors.primaryText : 'rgba(255,255,255,0.8)'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Quick Add Sets</Text>
              <Text style={styles.settingSubtitle}>Quickly add sets with previous values</Text>
            </View>
            <Switch
              value={settings.quickAddSets}
              onValueChange={(value) => updateSetting('quickAddSets', value)}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.brand }}
              thumbColor={settings.quickAddSets ? colors.primaryText : 'rgba(255,255,255,0.8)'}
            />
          </View>
        </View>
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* ...existing bottom sheet code... */}
    </View>
  </GestureHandlerRootView>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondaryText,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  section: {
    backgroundColor: colors.background,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: colors.primaryText,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    marginTop: 2,
  },
  settingValue: {
    fontSize: 14,
    color: colors.brand,
    marginTop: 4,
  },
  simpleTimeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  simpleTimeInput: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    color: colors.primaryText,
    textAlign: 'center',
    width: 50,
    marginRight: 8,
  },
  timeUnit: {
    fontSize: 14,
    color: colors.secondaryText,
    marginRight: 16,
  },
  simpleUnitContainer: {
    marginBottom: 16,
  },
  simpleUnitOptions: {
    flexDirection: 'row',
    marginTop: 8,
    backgroundColor: colors.background,
    borderRadius: 6,
    padding: 2,
  },
  simpleUnitOption: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 4,
  },
  simpleUnitOptionSelected: {
    backgroundColor: colors.brand,
  },
  simpleUnitOptionText: {
    fontSize: 14,
    color: colors.secondaryText,
    fontWeight: '500',
  },
  simpleUnitOptionTextSelected: {
    color: colors.primaryText,
  },
  bottomSpacing: {
    height: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    justifyContent: 'space-between', // Changed from 'center'
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingTop: 53,
  },
  
  headerSpacer: {
    minWidth: 60, // Same width as headerButton to balance the layout
  },
  
  headerButton: {
    padding: 8,
    minWidth: 60,
    alignItems: 'flex-end', // Align Done text to the right
  },
  
  headerTitle: {
    fontSize: 16,
    color: colors.primaryText,
    fontWeight: '500',
    textAlign: 'center',
    flex: 1, // Take up remaining space and center within it
  },
  
  doneButtonText: {
    color: colors.brand,
    fontWeight: '500',
    fontSize: 16,
  },

  bottomSheetContent: {
  flex: 1,
  padding: 20,
  paddingBottom: 30,
},

bottomSheetTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: colors.primaryText,
  textAlign: 'center',
  marginBottom: 8,
},

bottomSheetSubtitle: {
  fontSize: 14,
  color: colors.secondaryText,
  textAlign: 'center',
  marginBottom: 20,
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(255,255,255,0.1)',
  paddingBottom: 12,
},

bottomSheetList: {
  flex: 1,
  marginBottom: 20,
},

bottomSheetItem: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 16,
  marginBottom: 8,
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: 8,
  borderLeftWidth: 0,
},

selectedBottomSheetItem: {
  backgroundColor: colors.brand.replace('rgb', 'rgba').replace(')', ', 0.1)'),
},

bottomSheetItemInfo: {
  flex: 1,
},

bottomSheetItemText: {
  fontSize: 16,
  fontWeight: '600',
  color: colors.primaryText,
  marginBottom: 4,
},

selectedBottomSheetItemText: {
  color: colors.primaryText,
},

bottomSheetItemDescription: {
  fontSize: 14,
  color: colors.secondaryText,
},
});