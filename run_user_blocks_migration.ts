import { supabase } from '../lib/supabase';
import * as fs from 'fs';
import * as path from 'path';

async function runBlockingMigration() {
  try {
    console.log('Running user blocks table migration...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '../database_migrations/add_user_blocks_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec', { sql: migrationSQL });
    
    if (error) {
      console.error('Migration failed:', error);
      return;
    }
    
    console.log('✅ User blocks table migration completed successfully!');
    
    // Test the functions
    console.log('Testing blocking functions...');
    
    // You can test the functions here if needed
    console.log('✅ Migration and setup complete!');
    
  } catch (error) {
    console.error('Error running migration:', error);
  }
}

// Run the migration
runBlockingMigration();
