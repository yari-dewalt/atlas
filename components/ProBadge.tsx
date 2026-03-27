import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons as IonIcon } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useRouter } from 'expo-router';

export default function ProBadge() {
  const router = useRouter();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.badge}
      onPress={(e) => {
        e.stopPropagation();
        router.push('/pro');
      }}
    >
      <IonIcon name="ribbon" size={10} color={colors.primaryText} />
      <Text style={styles.text}>PRO</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryText,
  },
});
