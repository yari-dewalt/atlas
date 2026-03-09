import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AntDesign } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../constants/colors';
import CachedAvatar from './CachedAvatar';

interface RoutineCardProps {
  routine: {
    id: string;
    name: string;
    creator: string;
    creatorUsername?: string;
    creatorAvatar?: string | null;
    originalCreator?: string;
    originalCreatorAvatar?: string | null;
    exerciseCount: number;
    saveCount: number;
    usageCount: number;
    likeCount: number;
    isOfficial?: boolean;
    muscleGroups?: string[];
    exercises?: string[];
    created_at: Date;
    trendingScore?: number;
  };
  showTrendingBadge?: boolean;
  onPress?: () => void;
}

function RoutineCard({ routine, showTrendingBadge = false, onPress }: RoutineCardProps) {
  const router = useRouter();

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/routine/${routine.id}`);
    }
  }, [onPress, routine.id]);

  return (
    <TouchableOpacity
                activeOpacity={0.5} 
      style={styles.routineCard}
      onPress={handlePress}
    >
      <View style={styles.cardHeader}>
        <View style={styles.routineInfo}>
          <View style={styles.routineNameContainer}>
            <Text style={styles.routineName}>{routine.name}</Text>
            {routine.isOfficial && (
              <Ionicons name="shield-checkmark" size={16} color={colors.brand} style={[styles.officialBadge, showTrendingBadge && { marginRight: 10 }]} />
            )}
          </View>
          <Text style={styles.exerciseCount}>
            {routine.exerciseCount} {routine.exerciseCount === 1 ? 'exercise' : 'exercises'}
          </Text>
          
          {/* Exercise preview */}
          {routine.exercises && routine.exercises.length > 0 && (
            <View style={styles.exercisePreview}>
              <Text style={styles.exercisePreviewText}>
                {routine.exercises.slice(0, 3).join(' • ')}
                {routine.exercises.length > 3 && ` • +${routine.exercises.length - 3} more`}
              </Text>
            </View>
          )}
        </View>
        {showTrendingBadge && (
          <View style={styles.trendingBadge}>
            <Ionicons name="trending-up" size={14} color={colors.brand} />
            <Text style={styles.trendingText}>HOT</Text>
          </View>
        )}
      </View>
      
      {/* Muscle groups */}
      {routine.muscleGroups && routine.muscleGroups.length > 0 && (
        <View style={styles.muscleGroupsContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.muscleGroupsScroll}
          >
            {routine.muscleGroups.slice(0, 4).map((group, index) => (
              <View key={index} style={styles.muscleGroupTag}>
                <Text style={styles.muscleGroupText}>{group}</Text>
              </View>
            ))}
            {routine.muscleGroups.length > 4 && (
              <View style={styles.muscleGroupTag}>
                <Text style={styles.muscleGroupText}>+{routine.muscleGroups.length - 4}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
      
      {/* Creator info */}
      <View style={styles.creatorContainer}>
        <CachedAvatar
          path={routine.creatorAvatar}
          size={30}
          style={styles.creatorAvatar}
        />
        <Text style={styles.creatorText}>{routine.creatorUsername}</Text>
      </View>
      
      {/* Engagement metrics row */}
      <View style={styles.engagementMetrics}>
        <View style={styles.metric}>
          <Ionicons name="trending-up" size={16} color={colors.secondaryText} />
          <Text style={styles.metricText}>{routine.usageCount}</Text>
        </View>
        <View style={styles.metric}>
          <Ionicons name="bookmark" size={16} color={colors.secondaryText} />
          <Text style={styles.metricText}>{routine.saveCount}</Text>
        </View>
        <View style={styles.metric}>
          <Ionicons name="heart" size={16} color={colors.secondaryText} />
          <Text style={styles.metricText}>{routine.likeCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(RoutineCard);

const styles = StyleSheet.create({
  routineCard: {
    backgroundColor: colors.secondaryAccent,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: colors.overlay,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  routineInfo: {
    flex: 1,
  },
  routineNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routineName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 4,
    flex: 1,
  },
  officialBadge: {
    marginLeft: 4,
  },
  exerciseCount: {
    fontSize: 14,
    color: colors.secondaryText,
    marginTop: 4,
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  trendingText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.brand,
    letterSpacing: 0.5,
  },
  engagementMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.whiteOverlayLight,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    color: colors.secondaryText,
    fontWeight: '500',
  },
  muscleGroupsContainer: {
    marginBottom: 4,
  },
  muscleGroupsScroll: {
    gap: 6,
  },
  muscleGroupTag: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
  },
  muscleGroupText: {
    fontSize: 10,
    color: colors.secondaryText,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  exercisePreview: {
    marginTop: 8,
  },
  exercisePreviewText: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  creatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  creatorAvatar: {
    marginRight: 8,
  },
  creatorText: {
    fontSize: 15,
    color: colors.primaryText,
  },
});
