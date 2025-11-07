import { supabase } from '../lib/supabase';

export type ReportType = 
  | 'harassment'
  | 'hate_speech'
  | 'inappropriate_content'
  | 'spam'
  | 'misinformation'
  | 'violence'
  | 'self_harm'
  | 'copyright'
  | 'privacy_violation'
  | 'other';

export interface ReportReason {
  type: ReportType;
  label: string;
  description: string;
}

export const REPORT_REASONS: ReportReason[] = [
  {
    type: 'harassment',
    label: 'Harassment or Bullying',
    description: 'Targeting someone with abuse or threats'
  },
  {
    type: 'hate_speech',
    label: 'Hate Speech',
    description: 'Content that attacks people based on identity'
  },
  {
    type: 'inappropriate_content',
    label: 'Inappropriate Content',
    description: 'Explicit, graphic, or offensive material'
  },
  {
    type: 'spam',
    label: 'Spam',
    description: 'Repetitive or promotional content'
  },
  {
    type: 'misinformation',
    label: 'False Information',
    description: 'Deliberately misleading or false content'
  },
  {
    type: 'violence',
    label: 'Violence or Threats',
    description: 'Content promoting or threatening violence'
  },
  {
    type: 'self_harm',
    label: 'Self-Harm Content',
    description: 'Content promoting self-injury or suicide'
  },
  {
    type: 'copyright',
    label: 'Copyright Violation',
    description: 'Unauthorized use of copyrighted material'
  },
  {
    type: 'privacy_violation',
    label: 'Privacy Violation',
    description: 'Sharing private information without consent'
  },
  {
    type: 'other',
    label: 'Other',
    description: 'Something else that violates community guidelines'
  }
];

export const reportPost = async (
  postId: string,
  reporterId: string,
  reportType: ReportType,
  description?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('content_reports')
      .insert({
        post_id: postId,
        reporter_id: reporterId,
        report_type: reportType,
        description: description?.trim() || null
      });

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return { success: false, error: 'You have already reported this post' };
      }
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error reporting post:', error);
    return { success: false, error: 'Failed to submit report. Please try again.' };
  }
};

export const getUserReportStatus = async (
  postId: string, 
  userId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .rpc('has_user_reported_post', { 
        post_uuid: postId,
        user_uuid: userId 
      });

    if (error) throw error;
    return data || false;
  } catch (error) {
    console.error('Error checking report status:', error);
    return false;
  }
};

export const getPostReportCount = async (postId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .rpc('get_post_report_count', { post_uuid: postId });

    if (error) throw error;
    return data || 0;
  } catch (error) {
    console.error('Error getting report count:', error);
    return 0;
  }
};
