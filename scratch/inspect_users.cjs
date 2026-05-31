const dotenv = require('dotenv');
const pg = require('pg');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("supabase.co") ? { rejectUnauthorized: false } : undefined
});

async function main() {
  const ids = ['user_admin', 'user_teacher', 'user_student', 'user_finance', 'user_le_tan', 'user_academic', 'user_advisor', 'user_parent_demo'];
  const res = await pool.query("SELECT id, email, name, role, is_active FROM users WHERE id = ANY($1) OR email LIKE '%@mcna.local%' OR email = 'parent@mcna.local' ORDER BY role, id", [ids]);
  console.table(res.rows);
}

main().catch(console.error).finally(() => pool.end());
