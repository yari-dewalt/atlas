import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Alert, FlatList, Keyboard, TouchableWithoutFeedback, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AntDesign } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '../../../../constants/colors';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../stores/authStore';
import RoutineCard from '../../../../components/RoutineCard';
import RoutineListSkeleton from '../../../../components/RoutineListSkeleton';

export default function SearchCommunity() {
  const router = useRouter();
  const { session } = useAuthStore();
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortBy, setSortBy] = useState('recent'); // recent, popular, most_saved, most_used
  const [filterBy, setFilterBy] = useState('all'); // all, official, community
  
  // Search timeout for debouncing
  const [searchTimeout, setSearchTimeout] = useState(null);
  
  // Bottom sheet refs
  const filterBottomSheetRef = useRef<BottomSheet>(null);
  const sortBottomSheetRef = useRef<BottomSheet>(null);
  
  // Bottom sheet snap points
  const filterSnapPoints = useMemo(() => ['45%'], []);
  const sortSnapPoints = useMemo(() => ['40%'], []);
  
  // Backdrop component
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        enableTouchThrough={false}
      />
    ),
    []
  );
  
  // Helper functions for bottom sheets
  const openFilterSheet = () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    filterBottomSheetRef.current?.expand();
  };
  
  const openSortSheet = () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sortBottomSheetRef.current?.expand();
  };
  
  const closeFilterSheet = () => {
    filterBottomSheetRef.current?.close();
  };
  
  const closeSortSheet = () => {
    sortBottomSheetRef.current?.close();
  };

  // Perform search
  const performSearch = async (query, sort = sortBy, filter = filterBy) => {
    if (!query.trim() || query.length < 1) {
      setRoutines([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    
    try {
      let queryBuilder = supabase
        .from('routines')
        .select(`
          id,
          name,
          created_at,
          user_id,
          original_creator_id,
          save_count,
          usage_count,
          like_count,
          is_official
        `)
        .ilike('name', `%${query}%`);

      // Apply filters
      if (filter === 'official') {
        queryBuilder = queryBuilder.eq('is_official', true);
      } else if (filter === 'community') {
        queryBuilder = queryBuilder.eq('is_official', false);
      }

      // Apply sorting
      switch (sort) {
        case 'popular':
          queryBuilder = queryBuilder.order('like_count', { ascending: false });
          break;
        case 'most_saved':
          queryBuilder = queryBuilder.order('save_count', { ascending: false });
          break;
        case 'most_used':
          queryBuilder = queryBuilder.order('usage_count', { ascending: false });
          break;
        case 'recent':
        default:
          queryBuilder = queryBuilder.order('created_at', { ascending: false });
          break;
      }

      const { data: routinesData, error: routinesError } = await queryBuilder.limit(20);
      
      if (routinesError) throw routinesError;

      if (!routinesData || routinesData.length === 0) {
        setRoutines([]);
        return;
      }

      // Get routine IDs for fetching exercises
      const routineIds = routinesData.map(r => r.id);
      
      // Fetch routine exercises with exercise details
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('routine_exercises')
        .select(`
          routine_id,
          name,
          exercises (
            primary_muscle_group,
            secondary_muscle_groups
          )
        `)
        .in('routine_id', routineIds)
        .order('order_position');
      
      if (exercisesError) throw exercisesError;
      
      // Fetch profiles for creators
      const userIds = routinesData
        .map(routine => routine.user_id)
        .filter(Boolean);
      
      const uniqueUserIds = [...new Set(userIds)];
      
      let profilesMap = {};
      if (uniqueUserIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', uniqueUserIds);
        
        if (!profilesError && profiles) {
          profilesMap = profiles.reduce((map, profile) => {
            map[profile.id] = profile;
            return map;
          }, {});
        }
      }
      
      // Group exercises by routine_id
      const exercisesByRoutine = exercisesData.reduce((acc, exercise) => {
        if (!acc[exercise.routine_id]) {
          acc[exercise.routine_id] = [];
        }
        acc[exercise.routine_id].push(exercise);
        return acc;
      }, {});
      
      // Process routine data
      const processedRoutines = routinesData.map(routine => {
        const profile = profilesMap[routine.user_id];
        const originalCreatorProfile = profilesMap[routine.original_creator_id];
        const routineExercises = exercisesByRoutine[routine.id] || [];
        
        // Extract all muscle groups from exercises
        const allMuscleGroups = routineExercises.reduce((groups, exercise) => {
          if (exercise.exercises) {
            if (exercise.exercises.primary_muscle_group && !groups.includes(exercise.exercises.primary_muscle_group)) {
              groups.push(exercise.exercises.primary_muscle_group);
            }
            if (exercise.exercises.secondary_muscle_groups && Array.isArray(exercise.exercises.secondary_muscle_groups)) {
              exercise.exercises.secondary_muscle_groups.forEach(group => {
                if (!groups.includes(group)) {
                  groups.push(group);
                }
              });
            }
          }
          return groups;
        }, []);
        
        return {
          id: routine.id,
          name: routine.name,
          creator: profile?.username || 'Unknown',
          creatorUsername: profile?.username || 'Unknown',
          creatorAvatar: profile?.avatar_url || null,
          originalCreator: originalCreatorProfile?.username || routine.original_creator_id ? 'Unknown' : profile?.username || 'Unknown',
          originalCreatorAvatar: originalCreatorProfile?.avatar_url || routine.original_creator_id ? null : profile?.avatar_url || null,
          exerciseCount: routineExercises.length,
          usageCount: routine.usage_count || 0,
          saveCount: routine.save_count || 0,
          likeCount: routine.like_count || 0,
          isOfficial: routine.is_official || false,
          muscleGroups: allMuscleGroups,
          exercises: routineExercises.map(ex => ex.name) || [],
          created_at: new Date(routine.created_at)
        };
      });
      
      setRoutines(processedRoutines);
    } catch (error) {
      console.error('Error searching routines:', error);
      Alert.alert('Error', 'Failed to search routines');
      setRoutines([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle search input with debouncing
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout for debounced search
    const newTimeout = setTimeout(() => {
      performSearch(text);
    }, 500);
    
    setSearchTimeout(newTimeout);
  };

  // Handle filter/sort changes
  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    closeSortSheet();
    // Only trigger search if there's a query
    if (searchQuery.trim().length >= 2) {
      performSearch(searchQuery, newSort, filterBy);
    }
  };

  const handleFilterChange = (newFilter) => {
    if (newFilter === filterBy) {
      setFilterBy('all');
      return;
    }
    setFilterBy(newFilter);
    // Don't close sheet automatically - let user use Show Results button
    // Only trigger search if there's a query
    if (searchQuery.trim().length >= 1) {
      performSearch(searchQuery, sortBy, newFilter);
    }
  };

  const handleClearFilters = () => {
    setFilterBy('all');
    if (searchQuery.trim().length >= 2) {
      performSearch(searchQuery, sortBy, 'all');
    }
    closeFilterSheet();
  };

  const handleShowResults = () => {
    closeFilterSheet();
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.content}>
        <View style={styles.header}>
        <View style={[styles.searchContainer, Platform.OS === 'ios' ? { } : { paddingVertical: 2 }]}>
          <Ionicons name="search" size={20} color={colors.secondaryText} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for routines..."
            placeholderTextColor={colors.secondaryText}
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            onSubmitEditing={() => performSearch(searchQuery)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.clearButton}
              onPress={() => {
                setSearchQuery('');
                setRoutines([]);
                setHasSearched(false);
                if (searchTimeout) {
                  clearTimeout(searchTimeout);
                }
              }}
            >
              <Ionicons name="close-circle" size={20} color={colors.secondaryText} />
            </TouchableOpacity>
          )}
        </View>
        {/* Filter and Sort Buttons - Always visible */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
                activeOpacity={0.5} 
            style={[
              styles.controlButton, 
              filterBy !== 'all' && styles.controlButtonActive
            ]} 
            onPress={openFilterSheet}
          >
            <Ionicons name="funnel" size={16} color={filterBy !== 'all' ? colors.primaryText : colors.primaryText} />
            <Text style={[
              styles.controlButtonText,
              filterBy !== 'all' && styles.controlButtonTextActive
            ]}>
              Filters
            </Text>
            {filterBy !== 'all' ? (
              <View style={styles.filterCount}>
                <Text style={styles.filterCountText}>1</Text>
              </View>
            ) : (
              <Ionicons name="chevron-down" size={16} color={colors.secondaryText} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
                activeOpacity={0.5} style={styles.controlButton} onPress={openSortSheet}>
            <Ionicons name="swap-vertical" size={16} color={colors.primaryText} />
            <Text style={styles.controlButtonText}>
              {sortBy === 'recent' ? 'Recent' : sortBy === 'popular' ? 'Popular' : sortBy === 'most_saved' ? 'Most Saved' : 'Most Used'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.secondaryText} />
          </TouchableOpacity>
        </View>
        </View>

        {/* Results Area */}
        <View style={[styles.resultsContainer, loading && { paddingHorizontal: 0 }]}>
          {!hasSearched && searchQuery.length < 1 ? (
            // Initial state
            <View style={styles.placeholderContainer}>
              <Ionicons name="search" size={80} color={colors.brand} />
              <Text style={styles.placeholderTitle}>Search Community Routines</Text>
              <View style={styles.searchTips}>
                <Text style={styles.tipItem}>• Try exercise names like "bench press" or "squats"</Text>
                <Text style={styles.tipItem}>• Search by muscle groups like "chest" or "legs"</Text>
                <Text style={styles.tipItem}>• Look for routine types like "push pull" or "full body"</Text>
              </View>
            </View>
          ) : loading ? (
            // Loading state
            <RoutineListSkeleton />
          ) : routines.length > 0 ? (
            // Results
            <ScrollView showsVerticalScrollIndicator={true} style={styles.resultsScroll}>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>
                  {routines.length} routine{routines.length !== 1 ? 's' : ''} found
                </Text>
                <Text style={styles.resultsQuery}> for "{searchQuery}"</Text>
              </View>
              
              {routines.map((routine) => (
                <RoutineCard 
                  key={routine.id}
                  routine={routine}
                  showTrendingBadge={false}
                />
              ))}
            </ScrollView>
          ) : (
            // No results
            <View style={styles.noResultsContainer}>
              <Ionicons name="search" size={60} color={colors.secondaryText} />
              <Text style={styles.noResultsTitle}>No routines found</Text>
              <Text style={styles.noResultsText}>
                No routines match your search for "{searchQuery}".
              </Text>
              <Text style={styles.noResultsSuggestion}>
                Try different keywords or check your spelling.
              </Text>
            </View>
          )}
        </View>
        </View>
      </TouchableWithoutFeedback>
      
      {/* Filter Bottom Sheet */}
      <BottomSheet
        ref={filterBottomSheetRef}
        index={-1}
        snapPoints={filterSnapPoints}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.bottomSheetModalContent}>
          <Text style={styles.bottomSheetTitle}>Filters</Text>
          <Text style={styles.bottomSheetSubtitle}>
            Choose which routines to show
          </Text>
          
          <View style={styles.filterSections}>
            {/* Routine Type Section */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Type</Text>
              <View style={styles.filterButtonsRow}>
                <TouchableOpacity
                activeOpacity={0.5} 
                  style={[
                    styles.filterSquareButton,
                    filterBy === 'official' && styles.filterSquareButtonActive
                  ]}
                  onPress={() => handleFilterChange('official')}
                >
                  {filterBy === 'official' && (
                    <View style={styles.filterSquareCheckmark}>
                      <Ionicons name="checkmark" size={20} color={colors.brand} />
                    </View>
                  )}
                  <View style={styles.filterSquareIconContainer}>
                    <Ionicons 
                      name="shield-checkmark" 
                      size={32} 
                      color={colors.secondaryText} 
                    />
                  </View>
                  <Text style={styles.filterSquareButtonText}>
                    Official
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                activeOpacity={0.5} 
                  style={[
                    styles.filterSquareButton,
                    filterBy === 'community' && styles.filterSquareButtonActive
                  ]}
                  onPress={() => handleFilterChange('community')}
                >
                  {filterBy === 'community' && (
                    <View style={styles.filterSquareCheckmark}>
                      <Ionicons name="checkmark" size={16} color={colors.brand} />
                    </View>
                  )}
                  <View style={styles.filterSquareIconContainer}>
                    <Ionicons 
                      name="people" 
                      size={32} 
                      color={colors.secondaryText} 
                    />
                  </View>
                  <Text style={styles.filterSquareButtonText}>
                    Community
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.filterActionButtons}>
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.clearFiltersButton}
              onPress={handleClearFilters}
            >
              <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.showResultsButton}
              onPress={handleShowResults}
            >
              <Text style={styles.showResultsButtonText}>Show Results</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>
      
      {/* Sort Bottom Sheet */}
      <BottomSheet
        ref={sortBottomSheetRef}
        index={-1}
        snapPoints={sortSnapPoints}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.bottomSheetModalContent}>
          <Text style={styles.bottomSheetTitle}>Sort Routines</Text>
          <Text style={styles.bottomSheetSubtitle}>
            Choose how to order the results
          </Text>
          
          <View style={styles.bottomSheetOptionsContent}>
            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.bottomSheetOptionItem}
              onPress={() => handleSortChange('recent')}
            >
              <View style={styles.bottomSheetOptionIcon}>
                <Ionicons name="time" size={24} color={colors.primaryText} />
              </View>
              <View style={styles.bottomSheetOptionTextContainer}>
                <Text style={styles.bottomSheetOptionTitle}>Most Recent</Text>
                <Text style={styles.bottomSheetOptionDescription}>Show newest routines first</Text>
              </View>
              {sortBy === 'recent' && (
                <Ionicons name="checkmark" size={20} color={colors.brand} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.bottomSheetOptionItem}
              onPress={() => handleSortChange('popular')}
            >
              <View style={styles.bottomSheetOptionIcon}>
                <AntDesign name="like1" size={24} color={colors.primaryText} />
              </View>
              <View style={styles.bottomSheetOptionTextContainer}>
                <Text style={styles.bottomSheetOptionTitle}>Most Popular</Text>
                <Text style={styles.bottomSheetOptionDescription}>Show most liked routines first</Text>
              </View>
              {sortBy === 'popular' && (
                <Ionicons name="checkmark" size={20} color={colors.brand} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.bottomSheetOptionItem}
              onPress={() => handleSortChange('most_saved')}
            >
              <View style={styles.bottomSheetOptionIcon}>
                <Ionicons name="bookmark" size={24} color={colors.primaryText} />
              </View>
              <View style={styles.bottomSheetOptionTextContainer}>
                <Text style={styles.bottomSheetOptionTitle}>Most Saved</Text>
                <Text style={styles.bottomSheetOptionDescription}>Show most bookmarked routines first</Text>
              </View>
              {sortBy === 'most_saved' && (
                <Ionicons name="checkmark" size={20} color={colors.brand} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
                activeOpacity={0.5} 
              style={styles.bottomSheetOptionItem}
              onPress={() => handleSortChange('most_used')}
            >
              <View style={styles.bottomSheetOptionIcon}>
                <Ionicons name="trending-up" size={24} color={colors.primaryText} />
              </View>
              <View style={styles.bottomSheetOptionTextContainer}>
                <Text style={styles.bottomSheetOptionTitle}>Most Used</Text>
                <Text style={styles.bottomSheetOptionDescription}>Show most frequently used routines first</Text>
              </View>
              {sortBy === 'most_used' && (
                <Ionicons name="checkmark" size={20} color={colors.brand} />
              )}
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: colors.whiteOverlay,
    paddingTop: 16,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: colors.primaryText,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    marginBottom: 300,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.primaryText,
    marginTop: 16,
    marginBottom: 12,
  },
  // Search and filter styles
  clearButton: {
    marginLeft: 8,
  },
  controlsContainer: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 12,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
  },
  controlButtonActive: {
    backgroundColor: colors.brand,
    borderColor: colors.whiteOverlay,
  },
  controlButtonText: {
    flex: 1,
    fontSize: 14,
    color: colors.primaryText,
    fontWeight: '500',
  },
  controlButtonTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  filterCount: {
    backgroundColor: colors.primaryText,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  filterCountText: {
    fontSize: 12,
    color: colors.primaryAccent,
    fontWeight: '600',
  },
  // Results styles
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  loadingText: {
    marginTop: 12,
    color: colors.secondaryText,
    fontSize: 16,
  },
  resultsScroll: {
    flex: 1,
    paddingTop: 16,
  },
  resultsHeader: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultsCount: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },
  resultsQuery: {
    fontSize: 16,
    color: colors.secondaryText,
    marginTop: 2,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryText,
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 4,
  },
  noResultsSuggestion: {
    fontSize: 12,
    color: colors.secondaryText,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Search tips styles
  searchTips: {
  },
  tipItem: {
    fontSize: 12,
    color: colors.secondaryText,
    marginBottom: 4,
    textAlign: 'center',
  },
  // Bottom sheet styles
  bottomSheetBackground: {
    backgroundColor: colors.primaryAccent,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  bottomSheetIndicator: {
    backgroundColor: colors.secondaryText,
    width: 50,
  },
  bottomSheetModalContent: {
    padding: 20,
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
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
    paddingBottom: 12,
  },
  bottomSheetOptionsContent: {
    gap: 16,
  },
  // Filter sections styles
  filterSections: {
    gap: 24,
    marginBottom: 24,
  },
  filterSection: {
    gap: 12,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 4,
  },
  filterButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filterSquareButton: {
    flex: 1,
    backgroundColor: colors.primaryAccent,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.whiteOverlay,
    minHeight: 100,
    position: 'relative',
  },
  filterSquareButtonActive: {
    backgroundColor: colors.secondaryAccent,
    borderColor: colors.brand,
  },
  filterSquareCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSquareIconContainer: {
    marginBottom: 8,
  },
  filterSquareButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.secondaryText,
    textAlign: 'center',
  },
  // Action buttons styles
  filterActionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.whiteOverlay,
  },
  clearFiltersButton: {
    flex: 1,
    backgroundColor: colors.primaryAccent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.whiteOverlay,
  },
  clearFiltersButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primaryText,
  },
  showResultsButton: {
    flex: 1,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  showResultsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },
  // Sort bottom sheet styles (keeping for compatibility)
  bottomSheetOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlayLight,
  },
  bottomSheetOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.whiteOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bottomSheetOptionTextContainer: {
    flex: 1,
  },
  bottomSheetOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 2,
  },
  bottomSheetOptionDescription: {
    fontSize: 14,
    color: colors.secondaryText,
  },
});
