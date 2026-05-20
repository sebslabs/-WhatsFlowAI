const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = 'https://gnajmcduhagforoophav.supabase.co';
const supabaseKey = 'sb_publishable_AXKykSh__PL132LzMT_djQ_AxI_ri2y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Attempting test registration on Supabase...');
  const timestamp = Date.now();
  const { data, error } = await supabase.auth.signUp({
    email: `testuser_${timestamp}@test.com`,
    password: 'Password123!',
    options: {
      data: {
        full_name: 'Diagnostic Test Runner',
        organization_name: 'Diagnostic Corp',
      }
    }
  });

  if (error) {
    console.error('❌ SIGNUP FAILED with Error:');
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.log('✅ SIGNUP SUCCESSFUL!');
    console.log('User Object:', JSON.stringify(data.user, null, 2));
  }
}

test();
