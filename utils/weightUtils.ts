/**
 * Weight conversion utilities for converting between lbs and kg
 * All weights are stored in the database without units as numeric values
 */

export type WeightUnit = 'lbs' | 'kg';

// Conversion constants
const LBS_TO_KG = 0.453592;
const KG_TO_LBS = 2.20462;

/**
 * Convert weight from one unit to another
 * @param weight - The weight value to convert
 * @param fromUnit - The unit the weight is currently in
 * @param toUnit - The unit to convert the weight to
 * @returns The converted weight value, rounded to 1 decimal place
 */
export function convertWeight(weight: number, fromUnit: WeightUnit, toUnit: WeightUnit): number {
  if (fromUnit === toUnit) {
    return weight;
  }
  
  if (fromUnit === 'lbs' && toUnit === 'kg') {
    return Math.round(weight * LBS_TO_KG * 10) / 10;
  }
  
  if (fromUnit === 'kg' && toUnit === 'lbs') {
    return Math.round(weight * KG_TO_LBS * 10) / 10;
  }
  
  return weight;
}

/**
 * Format weight with appropriate unit display
 * @param weight - The weight value
 * @param unit - The unit to display
 * @param showUnit - Whether to show the unit suffix (default: true)
 * @returns Formatted weight string
 */
export function formatWeight(weight: number, unit: WeightUnit, showUnit: boolean = true): string {
  const roundedWeight = Math.round(weight);
  return showUnit ? `${roundedWeight} ${unit}` : roundedWeight.toString();
}

/**
 * Get the user's preferred weight unit from their profile
 * Falls back to 'lbs' if no preference is set
 * @param profile - User profile object
 * @returns The user's preferred weight unit
 */
export function getUserWeightUnit(profile: any): WeightUnit {
  return profile?.weight_unit || 'lbs';
}

/**
 * Convert and format weight for display to a user
 * This function assumes weights are stored in a standardized unit (we'll use kg as the storage standard)
 * @param storedWeight - The weight as stored in the database
 * @param storageUnit - The unit used for storage (typically 'kg')
 * @param userPreferredUnit - The user's preferred display unit
 * @param showUnit - Whether to show the unit suffix
 * @returns Formatted weight string in the user's preferred unit
 */
export function displayWeightForUser(
  storedWeight: number, 
  storageUnit: WeightUnit, 
  userPreferredUnit: WeightUnit, 
  showUnit: boolean = true
): string {
  const convertedWeight = convertWeight(storedWeight, storageUnit, userPreferredUnit);
  return formatWeight(convertedWeight, userPreferredUnit, showUnit);
}

/**
 * Convert weight from user's input unit to storage unit for database
 * @param inputWeight - The weight as entered by the user
 * @param userUnit - The unit the user entered the weight in
 * @param storageUnit - The unit to store in the database
 * @returns The weight converted to storage unit
 */
export function convertWeightForStorage(
  inputWeight: number, 
  userUnit: WeightUnit, 
  storageUnit: WeightUnit = 'kg'
): number {
  return convertWeight(inputWeight, userUnit, storageUnit);
}

/**
 * Convert weight for display purposes, rounded to whole numbers to avoid precision issues
 * @param storedWeight - The weight as stored in the database
 * @param storageUnit - The unit used for storage (typically 'kg')
 * @param displayUnit - The user's preferred display unit
 * @returns The weight converted and rounded to the nearest whole number
 */
export function convertWeightForDisplay(
  storedWeight: number, 
  storageUnit: WeightUnit, 
  displayUnit: WeightUnit
): number {
  const convertedWeight = convertWeight(storedWeight, storageUnit, displayUnit);
  return Math.round(convertedWeight);
}
