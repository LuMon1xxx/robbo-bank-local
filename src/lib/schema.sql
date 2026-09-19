-- robbo-bank-local · SQLite schema (WP1: SQLite-файл — долговременное хранилище)
-- Применяется на Tauri-bootstrap постстейтментно (см. sqliteSync.splitSqlStatements):
-- каждый стейтмент выполняется отдельным db.execute().
-- Сиды ИДЕМПОТЕНТНЫ (INSERT ... SELECT ... WHERE NOT EXISTS по естественному
-- ключу): повторный запуск на существующей базе не создаёт дубликатов.
-- Решение по дубликатам: естественные ключи — teachers.name и
-- reason_templates.label. Строки сидов никогда не обновляются in-place,
-- только добавляются при отсутствии, поэтому пользовательские правки
-- (если появятся) не затираются, а повторный сид не плодит копии.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  patronymic TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL,
  group_name VARCHAR(10) NOT NULL DEFAULT '',
  parent_phone TEXT NOT NULL DEFAULT '',
  birth_date TEXT NOT NULL DEFAULT '',
  balance INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS reason_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('accrual', 'write_off', 'any')),
  default_amount INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  op_type TEXT NOT NULL CHECK (op_type IN ('accrual', 'write_off', 'reversal')),
  amount INTEGER NOT NULL CHECK (amount >= 1 AND amount <= 100000),
  reason_id INTEGER NULL REFERENCES reason_templates (id),
  comment TEXT NOT NULL DEFAULT '',
  author_name TEXT NOT NULL DEFAULT '',
  source_op_type TEXT NULL CHECK (source_op_type IS NULL OR source_op_type IN ('accrual', 'write_off')),
  idempotency_key TEXT NOT NULL UNIQUE,
  correction_of_id TEXT NULL UNIQUE REFERENCES operations (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS group_members (
  student_id TEXT NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  UNIQUE (student_id, group_name)
);

CREATE TABLE IF NOT EXISTS operation_presets (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 1 AND amount <= 100000),
  reason_id INTEGER NULL REFERENCES reason_templates (id)
);

-- Seeds (idempotent: safe to re-run on every launch)
INSERT INTO teachers (name) SELECT 'Учитель 1' WHERE NOT EXISTS (SELECT 1 FROM teachers WHERE name = 'Учитель 1');
INSERT INTO teachers (name) SELECT 'Учитель 2' WHERE NOT EXISTS (SELECT 1 FROM teachers WHERE name = 'Учитель 2');

INSERT INTO reason_templates (label, kind, default_amount, is_active) SELECT 'За занятие', 'accrual', 4, 1 WHERE NOT EXISTS (SELECT 1 FROM reason_templates WHERE label = 'За занятие');
INSERT INTO reason_templates (label, kind, default_amount, is_active) SELECT 'Активность', 'accrual', 5, 1 WHERE NOT EXISTS (SELECT 1 FROM reason_templates WHERE label = 'Активность');
INSERT INTO reason_templates (label, kind, default_amount, is_active) SELECT 'Прочее', 'any', 5, 1 WHERE NOT EXISTS (SELECT 1 FROM reason_templates WHERE label = 'Прочее');
INSERT INTO reason_templates (label, kind, default_amount, is_active) SELECT 'Конкурс', 'accrual', 20, 1 WHERE NOT EXISTS (SELECT 1 FROM reason_templates WHERE label = 'Конкурс');
INSERT INTO reason_templates (label, kind, default_amount, is_active) SELECT 'Привёл друга', 'accrual', 15, 1 WHERE NOT EXISTS (SELECT 1 FROM reason_templates WHERE label = 'Привёл друга');
INSERT INTO reason_templates (label, kind, default_amount, is_active) SELECT 'Олимпиада', 'accrual', 30, 1 WHERE NOT EXISTS (SELECT 1 FROM reason_templates WHERE label = 'Олимпиада');
INSERT INTO reason_templates (label, kind, default_amount, is_active) SELECT 'Штраф', 'write_off', 5, 1 WHERE NOT EXISTS (SELECT 1 FROM reason_templates WHERE label = 'Штраф');
INSERT INTO reason_templates (label, kind, default_amount, is_active) SELECT 'Нарушение', 'write_off', 10, 1 WHERE NOT EXISTS (SELECT 1 FROM reason_templates WHERE label = 'Нарушение');

PRAGMA user_version = 1;
