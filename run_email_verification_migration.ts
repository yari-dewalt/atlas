import { supabase } from './lib/supabase';

async function runEmailVerificationMigration() {
  try {
    console.log('Running email verification migration...');
    
    // Add email_verified column
    console.log('Adding email_verified column...');
    const { error: columnError } = await supabase.rpc('exec', { 
      sql: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;` 
    });
    
    if (columnError) {
      console.error('Error adding column:', columnError);
      return;
    }
    
    // Create index
    console.log('Creating index...');
    const { error: indexError } = await supabase.rpc('exec', { 
      sql: `CREATE INDEX IF NOT EXISTS idx_profiles_email_verified ON public.profiles USING btree (email_verified);` 
    });
    
    if (indexError) {
      console.error('Error creating index:', indexError);
      return;
    }
    
    // Update existing users
    console.log('Updating existing users...');
    const { error: updateError } = await supabase.rpc('exec', { 
      sql: `UPDATE public.profiles SET email_verified = true WHERE created_at < NOW();` 
    });
    
    if (updateError) {
      console.error('Error updating existing users:', updateError);
      return;
    }
    
    console.log('✅ Email verification migration completed successfully!');
    
    // Verify the column was added
    const { data, error } = await supabase
      .from('profiles')
      .select('email_verified')
      .limit(1);
    
    if (error) {
      console.error('Error verifying migration:', error);
    } else {
      console.log('✅ Migration verified - email_verified column is accessible');
    }
    
  } catch (error) {
    console.error('Error running migration:', error);
  }
}

// Run the migration
runEmailVerificationMigration();
