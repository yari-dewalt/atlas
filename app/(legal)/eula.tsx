import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../../constants/colors';
import IonIcon from 'react-native-vector-icons/Ionicons';

export default function EULA() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams();
  
  const handleBack = () => {
    if (returnTo) {
      router.replace(returnTo as string);
    } else {
      router.back();
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
                activeOpacity={0.5} onPress={handleBack} style={styles.backButton}>
          <IonIcon name="arrow-back" size={24} color={colors.primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>End User License Agreement</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.lastUpdated}>Last updated: November 6, 2025</Text>
      
      <Text style={styles.sectionTitle}>1. User-Generated Content Policy</Text>
      <Text style={styles.text}>
        Atlas is a community platform where users share fitness content, including photos, videos, 
        comments, workout data, and other materials ("User Content"). You are solely responsible 
        for all User Content you post, upload, share, or otherwise make available through the App.
      </Text>
      <Text style={styles.text}>
        By posting User Content, you represent and warrant that:
      </Text>
      <Text style={styles.bulletText}>
        • You own or have the necessary rights to use and authorize the use of your User Content
      </Text>
      <Text style={styles.bulletText}>
        • Your User Content does not violate any applicable laws or regulations
      </Text>
      <Text style={styles.bulletText}>
        • Your User Content does not infringe upon the rights of any third party
      </Text>

      <Text style={styles.sectionTitle}>2. Prohibited Content and Conduct</Text>
      <Text style={styles.text}>
        Atlas maintains a zero-tolerance policy for objectionable content and abusive behavior. 
        The following types of content and conduct are strictly prohibited:
      </Text>
      
      <Text style={styles.subSectionTitle}>Content Violations:</Text>
      <Text style={styles.bulletText}>
        • Harassment, bullying, threats, or abusive behavior toward other users
      </Text>
      <Text style={styles.bulletText}>
        • Inappropriate, offensive, explicit, or sexually suggestive content
      </Text>
      <Text style={styles.bulletText}>
        • Hate speech, discriminatory content, or content promoting violence
      </Text>
      <Text style={styles.bulletText}>
        • Spam, misleading information, or fraudulent content
      </Text>
      <Text style={styles.bulletText}>
        • Content that violates others' privacy, including unauthorized photos or personal information
      </Text>
      <Text style={styles.bulletText}>
        • Illegal activities or content that promotes dangerous behavior
      </Text>
      <Text style={styles.bulletText}>
        • Impersonation of other individuals or entities
      </Text>

      <Text style={styles.subSectionTitle}>Behavioral Violations:</Text>
      <Text style={styles.bulletText}>
        • Creating multiple accounts to circumvent restrictions
      </Text>
      <Text style={styles.bulletText}>
        • Attempting to hack, disrupt, or interfere with the App's functionality
      </Text>
      <Text style={styles.bulletText}>
        • Sharing or distributing malware, viruses, or other harmful code
      </Text>
      <Text style={styles.bulletText}>
        • Commercial solicitation or unauthorized advertising
      </Text>

      <Text style={styles.sectionTitle}>3. Content Moderation and Enforcement</Text>
      <Text style={styles.text}>
        Atlas reserves the right to review, moderate, and remove any User Content at our sole 
        discretion. We may take immediate action against violations, including but not limited to:
      </Text>
      <Text style={styles.bulletText}>
        • Removal of violating content
      </Text>
      <Text style={styles.bulletText}>
        • Temporary suspension of user accounts
      </Text>
      <Text style={styles.bulletText}>
        • Permanent termination of user accounts
      </Text>
      <Text style={styles.bulletText}>
        • Reporting illegal activities to appropriate authorities
      </Text>

      <Text style={styles.text}>
        We strive to maintain a safe and positive community environment. Users are encouraged 
        to report violations through the App's reporting features.
      </Text>

      <Text style={styles.sectionTitle}>4. Health and Safety Disclaimers</Text>
      <Text style={styles.text}>
        Atlas is a fitness tracking and social platform. The App is not intended to provide 
        medical advice, diagnosis, or treatment. Always consult with qualified healthcare 
        professionals before beginning any fitness program or making health-related decisions.
      </Text>
      <Text style={styles.text}>
        Users participate in fitness activities at their own risk. Atlas is not responsible 
        for any injuries, health issues, or damages that may result from using the App or 
        following fitness content shared by other users.
      </Text>

      <Text style={styles.sectionTitle}>5. Privacy and Data Usage</Text>
      <Text style={styles.text}>
        Your privacy is important to us. Please review our Privacy Policy to understand how 
        we collect, use, and protect your personal information, including workout data, 
        fitness metrics, and other health-related information you share through the App.
      </Text>

      <Text style={styles.sectionTitle}>6. License and Intellectual Property</Text>
      <Text style={styles.text}>
        By posting User Content, you grant Atlas a non-exclusive, worldwide, royalty-free 
        license to use, display, reproduce, and distribute your content within the App for 
        the purpose of operating and improving our services.
      </Text>
      <Text style={styles.text}>
        You retain ownership of your User Content. This license does not transfer ownership 
        rights to Atlas.
      </Text>

      <Text style={styles.sectionTitle}>7. Account Termination</Text>
      <Text style={styles.text}>
        Atlas reserves the right to terminate or suspend user accounts immediately, without 
        prior notice, for violations of this EULA, Terms of Service, or for any conduct 
        that we determine to be harmful to other users or the Atlas community.
      </Text>

      <Text style={styles.sectionTitle}>8. Changes to This Agreement</Text>
      <Text style={styles.text}>
        We may update this EULA from time to time. We will notify users of any material 
        changes through the App or by email. Your continued use of Atlas after such 
        modifications constitutes acceptance of the updated EULA.
      </Text>

      <Text style={styles.sectionTitle}>9. Contact Information</Text>
      <Text style={styles.text}>
        If you have questions about this EULA or need to report violations, please contact 
        us through the App's support features or at support@atlas-app.com.
      </Text>

      <Text style={styles.text}>
        By using Atlas, you acknowledge that you have read, understood, and agree to be 
        bound by this End User License Agreement.
      </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteOverlay,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryText,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  lastUpdated: {
    fontSize: 14,
    color: colors.secondaryText,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryText,
    marginTop: 24,
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginTop: 16,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: colors.primaryText,
    lineHeight: 20,
    marginBottom: 12,
  },
  bulletText: {
    fontSize: 14,
    color: colors.primaryText,
    lineHeight: 20,
    marginBottom: 8,
    marginLeft: 16,
  },
});
