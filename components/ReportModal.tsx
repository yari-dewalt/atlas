import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { REPORT_REASONS, reportPost, ReportType } from '../utils/reportUtils';
import { useAuthStore } from '../stores/authStore';

interface ReportModalProps {
  postId: string;
  isVisible: boolean;
  onClose: () => void;
  onReportSubmitted?: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  postId,
  isVisible,
  onClose,
  onReportSubmitted
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportType | null>(null);
  const [description, setDescription] = useState('');
  const { session } = useAuthStore();

  if (!isVisible) return null;

  const handleSubmit = async () => {
    if (!selectedReason) return;

    Alert.alert(
      'Report Submitted',
      'Thank you for your report. We will review it and take appropriate action.',
      [{ text: 'OK', onPress: () => {
        onClose();
        onReportSubmitted?.();
        // Reset form
        setSelectedReason(null);
        setDescription('');
      }}]
    );
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDescription('');
    onClose();
  };

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    }}>
      <View style={{
        backgroundColor: colors.primaryAccent,
        borderRadius: 16,
        padding: 24,
        width: '90%',
        maxHeight: '80%',
      }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '600',
            color: colors.primaryText,
          }}>
            Report Post
          </Text>
          <TouchableOpacity
            onPress={handleClose}
            style={{ padding: 4 }}
          >
            <Ionicons name="close" size={24} color={colors.secondaryText} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={{
            fontSize: 16,
            color: colors.secondaryText,
            marginBottom: 16,
          }}>
            Why are you reporting this post?
          </Text>

          {/* Report Reasons */}
          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.type}
              onPress={() => setSelectedReason(reason.type)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.secondaryAccent,
              }}
            >
              <View style={[
                {
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  marginRight: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                selectedReason === reason.type
                  ? {
                      borderColor: colors.brand,
                      backgroundColor: colors.brand,
                    }
                  : {
                      borderColor: colors.placeholderText,
                      backgroundColor: 'transparent',
                    },
              ]}>
                {selectedReason === reason.type && (
                  <Ionicons name="checkmark" size={12} color={colors.background} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '500',
                  color: colors.primaryText,
                  marginBottom: 2,
                }}>
                  {reason.label}
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: colors.secondaryText,
                }}>
                  {reason.description}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* Additional Description */}
          <View style={{ marginTop: 20 }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '500',
              color: colors.primaryText,
              marginBottom: 8,
            }}>
              Additional Details (Optional)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Please provide any additional context..."
              placeholderTextColor={colors.placeholderText}
              multiline
              textAlignVertical="top"
              style={{
                borderWidth: 1,
                borderColor: colors.secondaryAccent,
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                color: colors.primaryText,
                backgroundColor: colors.secondaryAccent,
                height: 80,
              }}
              maxLength={500}
            />
            <Text style={{
              fontSize: 12,
              color: colors.placeholderText,
              textAlign: 'right',
              marginTop: 4,
            }}>
              {description.length}/500
            </Text>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 20,
          gap: 12,
        }}>
          <TouchableOpacity
            onPress={handleClose}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.placeholderText,
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.secondaryText,
            }}>
              Cancel
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!selectedReason}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 8,
              backgroundColor: selectedReason ? colors.notification : colors.secondaryAccent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: selectedReason ? colors.primaryText : colors.placeholderText,
            }}>
              Submit Report
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
