const dotenv = require('dotenv');
const pg = require('pg');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("supabase.co") ? { rejectUnauthorized: false } : undefined
});

async function main() {
  console.log("Fixing user_student's role to 'student' in PostgreSQL...");

  const res = await pool.query(
    "UPDATE users SET role = 'student' WHERE id = 'user_student' OR email = 'student@mcna.local' RETURNING *"
  );
  
  if (res.rowCount > 0) {
    console.log("✓ Successfully corrected user_student role:", res.rows[0]);
  } else {
    console.log("⚠️ user_student account not found in database.");
  }
}

main().catch(console.error).finally(() => pool.end());
