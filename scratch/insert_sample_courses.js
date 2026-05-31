const dotenv = require('dotenv');
const pg = require('pg');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("supabase.co") ? { rejectUnauthorized: false } : undefined
});

async function main() {
  console.log("Inserting 2 new sample courses...");

  const teacherId = "user_teacher"; // Prof. Linus Torvalds

  const course1 = {
    id: "course_microservices",
    title: "Advanced Microservices & Cloud Native",
    description: "Learn building scale-ready system design using Docker, Kubernetes, gRPC, and Kafka. Essential for DevOps and modern software engineers.",
    teacher_id: teacherId,
    status: "published",
    category: "DevOps & Infrastructure",
    price: 4200000,
    level: "Nâng cao",
    tags_json: JSON.stringify(["Microservices", "Kubernetes", "gRPC", "Kafka"]),
    thumbnail: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=600&auto=format&fit=crop&q=60",
    created_at: new Date("2026-05-30T10:00:00Z").toISOString()
  };

  const course2 = {
    id: "course_dataengineering",
    title: "Data Engineering & Real-Time Analytics Pipeline",
    description: "Master Spark streaming, Kafka events processing, and data warehouse patterns. Build high throughput data pipelines.",
    teacher_id: teacherId,
    status: "published",
    category: "Data Science",
    price: 2900000,
    level: "Trung cấp",
    tags_json: JSON.stringify(["Data Engineering", "Spark", "Kafka", "Data Warehouse"]),
    thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=60",
    created_at: new Date("2026-05-31T10:00:00Z").toISOString()
  };

  // Insert Course 1
  await pool.query(
    `INSERT INTO courses (id, title, description, teacher_id, status, category, thumbnail, price, level, tags_json, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       status = EXCLUDED.status,
       price = EXCLUDED.price`,
    [
      course1.id, course1.title, course1.description, course1.teacher_id,
      course1.status, course1.category, course1.thumbnail, course1.price,
      course1.level, course1.tags_json, course1.created_at
    ]
  );
  console.log("✓ Course 1 inserted successfully!");

  // Insert Course 2
  await pool.query(
    `INSERT INTO courses (id, title, description, teacher_id, status, category, thumbnail, price, level, tags_json, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       status = EXCLUDED.status,
       price = EXCLUDED.price`,
    [
      course2.id, course2.title, course2.description, course2.teacher_id,
      course2.status, course2.category, course2.thumbnail, course2.price,
      course2.level, course2.tags_json, course2.created_at
    ]
  );
  console.log("✓ Course 2 inserted successfully!");
}

main().catch(console.error).finally(() => pool.end());
