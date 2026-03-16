import { Stack, usePathname } from 'expo-router';
import { colors } from '../../../constants/colors';

export default function ModalsLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <Stack.Screen
        name="pro"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />

      <Stack.Screen
        name="newPost"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />

      <Stack.Screen 
        name="newWorkout" 
        options={{ 
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }} 
      />

    <Stack.Screen 
        name="saveWorkout" 
        options={{ 
          presentation: 'card',
          animation: 'slide_from_right',
        }} 
      />

  <Stack.Screen 
        name="exerciseSelection" 
        options={{ 
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }} 
      />

    <Stack.Screen 
        name="exerciseDetails" 
        options={{ 
          presentation: 'modal',
          animation: 'slide_from_right',
        }} 
      />

    <Stack.Screen 
        name="workoutSettings" 
        options={{ 
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }} 
      />

    <Stack.Screen 
        name="createCustomExercise" 
        options={{ 
          presentation: 'modal',
          animation: 'slide_from_right',
        }} 
      />
      
      <Stack.Screen 
        name="editPost/[postId]"
        options={{ 
          presentation: 'modal',
          animation: 'slide_from_right',
        }} 
      />

      <Stack.Screen 
        name="workout/[workoutId]"
        options={{ 
          presentation: 'card',
          animation: 'slide_from_right',
        }} 
      />

      <Stack.Screen 
        name="profile/[userId]"
        options={{ 
          presentation: 'card',
          animation: 'slide_from_right',
        }} 
      />

      <Stack.Screen 
        name="profile/[userId]/settings"
        options={{ 
          presentation: 'card',
          animation: 'slide_from_right',
        }} 
      />
      
      <Stack.Screen 
        name="profile/[userId]/index"
        options={{ 
          presentation: 'card',
          animation: 'slide_from_right',
        }} 
      />

      <Stack.Screen 
        name="routine/[routineId]/index"
        options={{ 
          presentation: 'card',
          animation: 'slide_from_right',
        }} 
      />

      <Stack.Screen 
        name="editRoutine/[routineId]/index"
        options={{ 
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }} 
      />

      <Stack.Screen 
        name="messages"
        options={{ 
          presentation: 'card',
          animation: 'slide_from_right',
        }} 
      />
      
      <Stack.Screen 
        name="profile/[userId]/activity"
        options={{ 
          presentation: 'card',
          animation: 'slide_from_right',
        }} 
      />
    </Stack>
  );
}