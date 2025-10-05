import { supabase } from '../lib/supabase';

export async function createProfileWithGoogleAvatar(user: any, googleUserInfo: any) {
  try {
    // Check if profile already exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing profile:', fetchError);
      return { error: fetchError };
    }

    // If profile already exists, update it with Google avatar and ensure email_verified is true
    if (existingProfile) {
      const updates: any = {};
      
      if (!existingProfile.avatar_url && googleUserInfo?.photo) {
        updates.avatar_url = googleUserInfo.photo;
      }
      
      // Ensure Google users are always marked as email verified
      if (existingProfile.email_verified !== true) {
        updates.email_verified = true;
      }
      
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
          return { error: updateError };
        }
      }
      return { data: { ...existingProfile, ...updates }, error: null };
    }

    // Create new profile with Google information
    const profileData = {
      id: user.id,
      email: user.email,
      full_name: googleUserInfo?.name || user.user_metadata?.full_name,
      avatar_url: googleUserInfo?.photo || user.user_metadata?.avatar_url,
      username: null, // Will be set during onboarding
      email_verified: true, // Google users are pre-verified
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert([profileData])
      .select()
      .single();

    if (insertError) {
      console.error('Error creating profile with Google avatar:', insertError);
      return { error: insertError };
    }

    return { data: newProfile, error: null };
  } catch (error) {
    console.error('Unexpected error in createProfileWithGoogleAvatar:', error);
    return { error };
  }
}
