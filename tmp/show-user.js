require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node tmp/show-user.js <email>');
  process.exit(1);
}

(async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('id_usuario, email, password_hash, activo')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('Supabase error:', error);
      process.exit(2);
    }

    console.log('DB result:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e);
    process.exit(3);
  }
})();
