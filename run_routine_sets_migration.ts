#!/usr/bin/env ts-node

import { supabase } from './lib/supabase';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  try {
    console.log('🚀 Running routine sets migration...');
    
    const migrationSQL = readFileSync(
      join(__dirname, 'database_migrations', 'add_routine_sets_table.sql'),
      'utf8'
    );
    
    // Split the SQL file by semicolons to execute statements individually
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      const { error } = await supabase.rpc('exec_sql', { 
        sql: statement + ';' 
      });
      
      if (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error);
        console.error('Statement:', statement);
        throw error;
      }
    }
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the migration worked
    console.log('🔍 Verifying migration...');
    const { data: routineSets, error: verifyError } = await supabase
      .from('routine_sets')
      .select('id')
      .limit(5);
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
    } else {
      console.log(`✅ Verification successful! Found ${routineSets?.length || 0} routine sets.`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { runMigration };
