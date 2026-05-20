const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Connecting to Supabase and executing migration...");
  
  const sql = `
    BEGIN;
    -- 1. Drop old constraint safely
    ALTER TABLE public.knowledge_base 
      DROP CONSTRAINT IF EXISTS knowledge_base_source_type_check;

    -- 2. Add updated check constraint to allow 'image'
    ALTER TABLE public.knowledge_base
      ADD CONSTRAINT knowledge_base_source_type_check 
      CHECK (source_type IN ('text', 'url', 'pdf', 'faq', 'image'));
    COMMIT;
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error("❌ Migration failed via RPC:", error);
    } else {
      console.log("✅ Check constraint updated successfully!", data);
    }
  } catch (err) {
    console.error("❌ Script exception:", err);
  }
}

run();
