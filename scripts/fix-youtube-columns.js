#!/usr/bin/env node
/**
 * Fix missing youtube_videos columns
 *
 * Adds channel_id and channel_title columns that were missing from the
 * migration's DO block for existing tables.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixColumns() {
  console.log('Adding missing columns to youtube_videos table...');

  // Use raw SQL via rpc or direct query
  // Since Supabase JS client doesn't support raw DDL, we'll use the REST API
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      sql: `
        ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS channel_id VARCHAR(50);
        ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS channel_title VARCHAR(200);
      `
    }),
  });

  if (!response.ok) {
    // The exec_sql function likely doesn't exist, so we need another approach
    console.log('exec_sql not available, trying alternative approach...');

    // Try inserting a test record to see the current schema
    const { data, error } = await supabase
      .from('youtube_videos')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error querying youtube_videos:', error.message);
    } else {
      console.log('Current table columns:', data.length > 0 ? Object.keys(data[0]) : 'Table is empty');
    }

    console.log('\n========================================');
    console.log('MANUAL FIX REQUIRED');
    console.log('========================================\n');
    console.log('Please run the following SQL in Supabase Dashboard → SQL Editor:\n');
    console.log('ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS channel_id VARCHAR(50);');
    console.log('ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS channel_title VARCHAR(200);');
    console.log('\n========================================\n');

    return false;
  }

  console.log('Columns added successfully!');
  return true;
}

fixColumns().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
