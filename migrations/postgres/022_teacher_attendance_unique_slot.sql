WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY teacher_id, section_id, class_date, slot_time
      ORDER BY checked_in_at DESC, id DESC
    ) AS rn
  FROM teacher_attendance
)
DELETE FROM teacher_attendance
WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_attendance_unique_slot
ON teacher_attendance (teacher_id, section_id, class_date, slot_time);
