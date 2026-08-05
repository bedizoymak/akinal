<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';

require_admin();
require_method('POST');

/**
 * Migration: create the five personnel tables (ak_roles, ak_employee_roles,
 * ak_employee_cost_periods, ak_employee_project_assignments,
 * ak_employee_project_allocations) if they are missing.
 *
 * These tables are already defined in install-schema.php, but that installer
 * is gated behind ENABLE_SETUP_TOOL and a manual confirmation step, so a
 * schema addition made after the initial production install never reaches
 * the live database unless someone deliberately re-runs it. When these
 * tables are absent, every personnel-roles/cost-period/project-assignment/
 * allocation endpoint throws on its first query and the admin UI reports
 * "yüklenemedi" with no way to recover.
 *
 * Idempotent (CREATE TABLE IF NOT EXISTS) and safe to run multiple times —
 * matches the existing gpp-collections-apply.php / gpp-breakdowns-apply.php
 * pattern. Existing data in any of these tables is never touched.
 */

try {
    $created = [];

    foreach (epta_table_definitions() as $table => $sql) {
        $existedBefore = epta_table_exists($table);
        db()->exec($sql);
        $created[$table] = !$existedBefore;
    }

    json_success([
        'tables_created' => $created,
        'message'        => 'Personel tabloları kontrol edildi/oluşturuldu.',
    ]);
} catch (Throwable $e) {
    error_log('[employee-personnel-tables-apply.php] ' . get_class($e) . ': ' . $e->getMessage());
    json_error('Migration başarısız: ' . $e->getMessage(), 500);
}

function epta_table_exists(string $table): bool
{
    $stmt = db()->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $stmt->execute(['t' => $table]);
    return (bool) $stmt->fetchColumn();
}

/**
 * Definitions copied verbatim from install-schema.php, in FK-safe creation order
 * (ak_roles before ak_employee_roles; ak_employees/ak_projects are assumed to
 * already exist, which they do on every environment this migration is meant for).
 */
function epta_table_definitions(): array
{
    return [
        'ak_roles' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_roles (
  id              CHAR(36)     NOT NULL,
  name            VARCHAR(100) NOT NULL,
  normalized_name VARCHAR(100) NOT NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_normalized (normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

        'ak_employee_roles' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_employee_roles (
  employee_id CHAR(36) NOT NULL,
  role_id     CHAR(36) NOT NULL,
  assigned_at DATE     NOT NULL,
  ended_at    DATE         NULL,
  PRIMARY KEY (employee_id, role_id, assigned_at),
  KEY idx_employee_roles_employee (employee_id),
  KEY idx_employee_roles_role     (role_id),
  CONSTRAINT fk_employee_roles_employee FOREIGN KEY (employee_id) REFERENCES ak_employees(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_employee_roles_role     FOREIGN KEY (role_id)     REFERENCES ak_roles(id)     ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

        'ak_employee_cost_periods' => <<<'SQL'
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
  CONSTRAINT fk_cost_periods_employee FOREIGN KEY (employee_id) REFERENCES ak_employees(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

        'ak_employee_project_assignments' => <<<'SQL'
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
  CONSTRAINT fk_epa_employee FOREIGN KEY (employee_id) REFERENCES ak_employees(id) ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT fk_epa_project  FOREIGN KEY (project_id)  REFERENCES ak_projects(id)  ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

        'ak_employee_project_allocations' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_employee_project_allocations (
  id                      CHAR(36)      NOT NULL,
  employee_id             CHAR(36)      NOT NULL,
  project_id              CHAR(36)      NOT NULL,
  allocation_year         SMALLINT      NOT NULL,
  allocation_month        TINYINT       NOT NULL,
  days_worked             DECIMAL(5,2)  NOT NULL,
  working_days_base       TINYINT       NOT NULL,
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
  CONSTRAINT fk_alloc_employee FOREIGN KEY (employee_id) REFERENCES ak_employees(id) ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT fk_alloc_project  FOREIGN KEY (project_id)  REFERENCES ak_projects(id)  ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
    ];
}
