// Example usage of the progress bar system
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { progressUtils, PROGRESS_LABELS, useProgressStore } from '../stores/progressStore';
import { colors } from '../constants/colors';

const ProgressExampleComponent = () => {
  
  // Example 1: Simple loading with unknown duration
  const handleSimpleLoading = async () => {
    const loadingInterval = progressUtils.startLoading(PROGRESS_LABELS.LOADING);
    
    // Simulate an API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    clearInterval(loadingInterval);
    progressUtils.completeLoading();
  };
  
  // Example 2: Step-by-step progress
  const handleStepProgress = async () => {
    try {
      // Step 1
      progressUtils.stepProgress(1, 4, 'Processing images...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2
      progressUtils.stepProgress(2, 4, PROGRESS_LABELS.UPLOADING_MEDIA);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Step 3
      progressUtils.stepProgress(3, 4, PROGRESS_LABELS.SAVING_POST);
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Step 4
      progressUtils.stepProgress(4, 4, 'Complete!');
      
      // Auto-hide after showing completion
      setTimeout(() => {
        progressUtils.completeLoading();
      }, 500);
      
    } catch (error) {
      progressUtils.cancelLoading();
    }
  };
  
  // Example 3: Manual progress control
  const handleManualProgress = async () => {
    const { showProgress, updateProgress, hideProgress } = useProgressStore.getState();
    
    try {
      showProgress('Manual progress...');
      
      // Increment progress manually
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        updateProgress(i);
      }
      
      // Hide after brief delay
      setTimeout(hideProgress, 300);
      
    } catch (error) {
      hideProgress();
    }
  };
  
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handleSimpleLoading}>
        <Text style={styles.buttonText}>Simple Loading</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={handleStepProgress}>
        <Text style={styles.buttonText}>Step Progress</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={handleManualProgress}>
        <Text style={styles.buttonText}>Manual Progress</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
  },
  button: {
    backgroundColor: colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: '600',
  },
});

export default ProgressExampleComponent;
