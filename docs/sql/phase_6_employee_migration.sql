-- ============================================================================
-- Phase 6 — ak_employees Architecture Migration
-- ============================================================================
-- Execute via agent-sql.php in this exact order (FK dependencies).
-- All statements use IF NOT EXISTS so re-execution is safe.
-- Run seed INSERT after Step 1 completes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: ak_roles
-- No FK dependencies. Must exist before ak_employee_roles.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ak_roles (
  id              CHAR(36)     NOT NULL,
  name            VARCHAR(100) NOT NULL,
  normalized_name VARCHAR(100) NOT NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_normalized (normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Step 1 seed: standard construction roles
-- INSERT IGNORE prevents duplicates if re-run.
-- Generate UUIDs with: python -c "import uuid; print(str(uuid.uuid4()))"
-- Replace placeholders below with real UUIDs before executing.
-- ---------------------------------------------------------------------------

-- INSERT IGNORE INTO ak_roles (id, name, normalized_name) VALUES
--   (UUID(), 'Formen',            'formen'),
--   (UUID(), 'Ustabaşı',          'ustabasi'),
--   (UUID(), 'Makine Operatörü',  'makine operatoru'),
--   (UUID(), 'Mühendis',          'muhendis'),
--   (UUID(), 'Şef Mühendis',      'sef muhendis'),
--   (UUID(), 'Şantiye Şefi',      'santiye sefi'),
--   (UUID(), 'İşçi',              'isci'),
--   (UUID(), 'Serbest Çalışan',   'serbest calisan');

-- NOTE: The API endpoint POST /api/admin/roles.php will seed these roles
-- on first-time setup. Use that endpoint instead of raw SQL to avoid
-- UUID generation issues.

-- ---------------------------------------------------------------------------
-- Step 2: ak_employee_roles
-- Depends on: ak_employees (exists), ak_roles (step 1).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ak_employee_roles (
  employee_id CHAR(36) NOT NULL,
  role_id     CHAR(36) NOT NULL,
  assigned_at DATE     NOT NULL,
  ended_at    DATE         NULL,

  PRIMARY KEY (employee_id, role_id, assigned_at),
  KEY idx_employee_roles_employee (employee_id),
  KEY idx_employee_roles_role     (role_id),

  CONSTRAINT fk_employee_roles_employee
    FOREIGN KEY (employee_id) REFERENCES ak_employees(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_employee_roles_role
    FOREIGN KEY (role_id) REFERENCES ak_roles(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Step 3: ak_employee_cost_periods
-- Depends on: ak_employees (exists).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ak_employee_cost_periods (
  id             CHAR(36)      NOT NULL,
  employee_id    CHAR(36)      NOT NULL,
  effective_from DATE          NOT NULL,
  effective_to   DATE              NULL,
  salary         DECIMAL(14,2) NOT NULL DEFAULT 0,
  sgk            DECIMAL(14,2) NOT NULL DEFAULT 0,
  meal           DECIMAL(14,2) NOT NULL DEFAULT 0,
  transportation DECIMAL(14,2) NOT NULL DEFAULT 0,
  bonus          DECIMAL(14,2) NOT NULL DEFAULT 0,
  accommodation  DECIMAL(14,2) NOT NULL DEFAULT 0,
  other          DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes          TEXT              NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_cost_period_employee_from (employee_id, effective_from),
  KEY idx_cost_periods_employee           (employee_id),

  CONSTRAINT fk_cost_periods_employee
    FOREIGN KEY (employee_id) REFERENCES ak_employees(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Step 4: ak_employee_project_assignments
-- Depends on: ak_employees (exists), ak_projects (exists).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ak_employee_project_assignments (
  id          CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,
  project_id  CHAR(36) NOT NULL,
  start_date  DATE     NOT NULL,
  end_date    DATE         NULL,
  notes       TEXT         NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_epa_employee (employee_id),
  KEY idx_epa_project  (project_id),
  KEY idx_epa_emp_proj (employee_id, project_id),

  CONSTRAINT fk_epa_employee
    FOREIGN KEY (employee_id) REFERENCES ak_employees(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_epa_project
    FOREIGN KEY (project_id) REFERENCES ak_projects(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Step 5: ak_employee_project_allocations
-- Depends on: ak_employees (exists), ak_projects (exists).
-- No FK to ak_employee_cost_periods — snapshot values are copied at creation.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ak_employee_project_allocations (
  id                      CHAR(36)      NOT NULL,
  employee_id             CHAR(36)      NOT NULL,
  project_id              CHAR(36)      NOT NULL,
  allocation_year         SMALLINT      NOT NULL,
  allocation_month        TINYINT       NOT NULL,
  days_worked             DECIMAL(5,2)  NOT NULL,
  working_days_base       TINYINT       NOT NULL,

  -- Snapshot columns — written once at creation, never updated.
  -- Copied from ak_employee_cost_periods at allocation creation time.
  cost_date               DATE          NOT NULL,
  salary_snapshot         DECIMAL(14,2) NOT NULL DEFAULT 0,
  sgk_snapshot            DECIMAL(14,2) NOT NULL DEFAULT 0,
  meal_snapshot           DECIMAL(14,2) NOT NULL DEFAULT 0,
  transportation_snapshot DECIMAL(14,2) NOT NULL DEFAULT 0,
  bonus_snapshot          DECIMAL(14,2) NOT NULL DEFAULT 0,
  accommodation_snapshot  DECIMAL(14,2) NOT NULL DEFAULT 0,
  other_snapshot          DECIMAL(14,2) NOT NULL DEFAULT 0,
  monthly_cost_snapshot   DECIMAL(14,2) NOT NULL,
  calculated_cost         DECIMAL(14,2) NOT NULL,

  notes      TEXT     NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_allocation          (employee_id, project_id, allocation_year, allocation_month),
  KEY idx_alloc_project_period      (project_id, allocation_year, allocation_month),
  KEY idx_alloc_employee_period     (employee_id, allocation_year, allocation_month),

  CONSTRAINT fk_alloc_employee
    FOREIGN KEY (employee_id) REFERENCES ak_employees(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_alloc_project
    FOREIGN KEY (project_id) REFERENCES ak_projects(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Step 6: ak_payment_plans.employee_id FK (independent — verify first)
-- Run this only after confirming no FK exists:
--   SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
--   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ak_payment_plans'
--   AND COLUMN_NAME = 'employee_id' AND REFERENCED_TABLE_NAME = 'ak_employees';
-- If 0 rows: safe to run the ALTER below.
-- ---------------------------------------------------------------------------

-- ALTER TABLE ak_payment_plans
--   ADD CONSTRAINT fk_payment_plans_employee
--     FOREIGN KEY (employee_id) REFERENCES ak_employees(id)
--     ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Rollback (reverse order, run only with owner approval + data export first)
-- ---------------------------------------------------------------------------

-- DROP TABLE IF EXISTS ak_employee_project_allocations;
-- DROP TABLE IF EXISTS ak_employee_project_assignments;
-- DROP TABLE IF EXISTS ak_employee_cost_periods;
-- DROP TABLE IF EXISTS ak_employee_roles;
-- DROP TABLE IF EXISTS ak_roles;
