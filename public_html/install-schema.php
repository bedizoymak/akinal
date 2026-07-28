<?php
declare(strict_types=1);

/**
 * MySQL schema installer converted from the Supabase/PostgreSQL migrations.
 *
 * Replace the placeholder username/password before running on shared hosting.
 * This file is safe to rerun: all tables use CREATE TABLE IF NOT EXISTS.
 */

$host = 'localhost';
$database = 'akinalin_wp282';
$username = 'MYSQL_USERNAME_HERE';
$password = 'MYSQL_PASSWORD_HERE';
$charset = 'utf8mb4';

$dsn = "mysql:host={$host};dbname={$database};charset={$charset}";

const ENABLE_SETUP_TOOL = false;

if (!ENABLE_SETUP_TOOL) {
    http_response_code(403);
    echo "<pre>This installer is disabled for launch readiness.\n";
    echo "Enable it only in a temporary setup copy, run the install, then delete that copy immediately.</pre>";
    exit;
}

if (($_GET['confirm'] ?? '') !== 'INSTALL_AKINAL_SCHEMA') {
    echo "<pre>This installer is locked.\n";
    echo "To run it intentionally, open install-schema.php?confirm=INSTALL_AKINAL_SCHEMA.\n";
    echo "Delete this file immediately after a successful production install.</pre>";
    exit;
}

if (!extension_loaded('pdo_mysql')) {
    http_response_code(500);
    echo "<pre>Cannot run installer: the pdo_mysql PHP extension is not loaded.</pre>";
    exit;
}

$tables = [
    'ak_admin_users' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_admin_users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  -- PHP/API code must always write strtolower(email) into email_lower on admin create/update.
  email_lower VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_users_email (email),
  UNIQUE KEY idx_admin_users_email_lower (email_lower)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_profiles' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_profiles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  email VARCHAR(255) NULL,
  display_name VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_profiles_user_id (user_id),
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES ak_admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_user_roles' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_user_roles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  role VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_roles_user_role (user_id, role),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES ak_admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_projects' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_projects (
  id CHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  short_description TEXT NOT NULL,
  detailed_description LONGTEXT NULL,
  project_type VARCHAR(100) NOT NULL,
  project_status VARCHAR(100) NOT NULL,
  location VARCHAR(255) NOT NULL,
  city VARCHAR(100) NULL,
  district VARCHAR(100) NULL,
  start_year VARCHAR(20) NULL,
  delivery_year VARCHAR(20) NULL,
  land_area VARCHAR(100) NULL,
  construction_area VARCHAR(100) NULL,
  apartment_count VARCHAR(100) NULL,
  floor_count VARCHAR(100) NULL,
  block_count VARCHAR(100) NULL,
  cover_image_url TEXT NULL,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  seo_title VARCHAR(255) NULL,
  seo_description TEXT NULL,
  contract_total_try DECIMAL(14,2) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_projects_slug (slug),
  KEY idx_projects_published (is_published, sort_order),
  KEY idx_projects_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_project_images' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_project_images (
  id CHAR(36) NOT NULL PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT NULL,
  title VARCHAR(255) NULL,
  alt_text VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_project_images_project (project_id, sort_order),
  CONSTRAINT fk_project_images_project FOREIGN KEY (project_id) REFERENCES ak_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_media_library' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_media_library (
  id CHAR(36) NOT NULL PRIMARY KEY,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT NULL,
  file_name VARCHAR(255) NULL,
  title VARCHAR(255) NULL,
  alt_text VARCHAR(255) NULL,
  related_project_id CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_media_library_related_project (related_project_id),
  CONSTRAINT fk_media_library_project FOREIGN KEY (related_project_id) REFERENCES ak_projects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_site_settings' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_site_settings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL DEFAULT 'Akinal İnşaat',
  phone VARCHAR(50) NULL DEFAULT '+90 000 000 00 00',
  whatsapp_number VARCHAR(50) NULL DEFAULT '+90 000 000 00 00',
  email VARCHAR(255) NULL DEFAULT 'info@akinalinsaat.com',
  address TEXT NULL,
  map_embed_url TEXT NULL,
  instagram_url TEXT NULL,
  facebook_url TEXT NULL,
  linkedin_url TEXT NULL,
  footer_description TEXT NULL,
  hero_title VARCHAR(255) NULL DEFAULT 'Güvenli Yapılar, Değerli Yaşam Alanları',
  hero_subtitle TEXT NULL,
  whatsapp_message TEXT NULL,
  seo_title VARCHAR(255) NULL DEFAULT 'Akinal İnşaat | Kentsel Dönüşüm ve İnşaat Hizmetleri',
  seo_description TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_contact_requests' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_contact_requests (
  id CHAR(36) NOT NULL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(100) NOT NULL,
  email VARCHAR(255) NULL,
  service_type VARCHAR(100) NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Yeni',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_customers' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_customers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  customer_type VARCHAR(100) NOT NULL DEFAULT 'Bireysel',
  full_name VARCHAR(255) NULL,
  company_name VARCHAR(255) NULL,
  phone VARCHAR(100) NOT NULL DEFAULT '',
  whatsapp VARCHAR(100) NULL,
  email VARCHAR(255) NULL,
  tax_or_identity_number VARCHAR(100) NULL,
  address TEXT NULL,
  city VARCHAR(100) NULL,
  district VARCHAR(100) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Aktif',
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_customer_projects' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_customer_projects (
  id CHAR(36) NOT NULL PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  project_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customer_projects_customer_project (customer_id, project_id),
  KEY idx_customer_projects_customer (customer_id),
  KEY idx_customer_projects_project (project_id),
  CONSTRAINT fk_customer_projects_customer FOREIGN KEY (customer_id) REFERENCES ak_customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_projects_project FOREIGN KEY (project_id) REFERENCES ak_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_payment_plans' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_payment_plans (
  id                       CHAR(36)      NOT NULL PRIMARY KEY,
  customer_id              CHAR(36)      NOT NULL,
  project_id               CHAR(36)      NOT NULL,
  title                    VARCHAR(255)  NOT NULL,
  description              TEXT              NULL,
  type                     VARCHAR(80)   NOT NULL DEFAULT 'Diğer',
  amount                   DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  paid_amount              DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  currency                 VARCHAR(10)   NOT NULL DEFAULT 'TRY',
  payment_method           VARCHAR(40)   NOT NULL DEFAULT 'Nakit',
  transaction_reference    VARCHAR(120)      NULL,
  card_note                VARCHAR(255)      NULL,
  cheque_maturity_date     DATE              NULL,
  cheque_no                VARCHAR(80)       NULL,
  bank_name                VARCHAR(120)      NULL,
  promissory_maturity_date DATE              NULL,
  account_type             VARCHAR(20)   NOT NULL DEFAULT 'resmi',
  date                     DATE          NOT NULL,
  status                   VARCHAR(50)   NOT NULL DEFAULT 'Planlanan',
  notes                    TEXT              NULL,
  created_at               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payment_plans_customer     (customer_id),
  KEY idx_payment_plans_project      (project_id),
  KEY idx_payment_plans_date         (`date`),
  KEY idx_payment_plans_account_type (account_type),
  KEY idx_payment_plans_status       (status),
  CONSTRAINT fk_payment_plans_customer FOREIGN KEY (customer_id) REFERENCES ak_customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payment_plans_project  FOREIGN KEY (project_id)  REFERENCES ak_projects(id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_payments' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_payments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  customer_id CHAR(36) NULL,
  project_id CHAR(36) NULL,
  payment_plan_id CHAR(36) NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  account_type VARCHAR(20) NOT NULL DEFAULT 'resmi',
  payment_date DATE NOT NULL,
  payment_method VARCHAR(100) NOT NULL DEFAULT 'Nakit',
  description TEXT NULL,
  document_url TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payments_customer (customer_id),
  KEY idx_payments_account_type (account_type),
  KEY idx_payments_project (project_id),
  KEY idx_payments_plan (payment_plan_id),
  CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES ak_customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_project FOREIGN KEY (project_id) REFERENCES ak_projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_plan FOREIGN KEY (payment_plan_id) REFERENCES ak_payment_plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_expenses' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_expenses (
  id CHAR(36) NOT NULL PRIMARY KEY,
  project_id CHAR(36) NULL,
  customer_id CHAR(36) NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Diğer',
  amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  expense_date DATE NOT NULL,
  description TEXT NULL,
  document_url TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_expenses_project (project_id),
  KEY idx_expenses_customer (customer_id),
  KEY idx_expenses_date (expense_date),
  CONSTRAINT fk_expenses_project FOREIGN KEY (project_id) REFERENCES ak_projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_expenses_customer FOREIGN KEY (customer_id) REFERENCES ak_customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_customer_notes' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_customer_notes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  note TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_customer_notes_customer (customer_id),
  CONSTRAINT fk_customer_notes_customer FOREIGN KEY (customer_id) REFERENCES ak_customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_notifications' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_notifications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(100) NOT NULL DEFAULT 'Genel',
  priority VARCHAR(50) NOT NULL DEFAULT 'Orta',
  related_customer_id CHAR(36) NULL,
  related_project_id CHAR(36) NULL,
  related_payment_plan_id CHAR(36) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_created_at (created_at),
  KEY idx_notifications_is_read (is_read),
  KEY idx_notifications_plan (related_payment_plan_id),
  KEY idx_notifications_customer (related_customer_id),
  KEY idx_notifications_project (related_project_id),
  CONSTRAINT fk_notifications_customer FOREIGN KEY (related_customer_id) REFERENCES ak_customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_notifications_project FOREIGN KEY (related_project_id) REFERENCES ak_projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_notifications_plan FOREIGN KEY (related_payment_plan_id) REFERENCES ak_payment_plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_employees' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_employees (
  id CHAR(36) NOT NULL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(100) NULL,
  role VARCHAR(100) NULL,
  notes TEXT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Aktif',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

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

    'ak_expense_cards' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_expense_cards (
  id   CHAR(36)     NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  KEY idx_expense_cards_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    // ── NEW FINANCE ARCHITECTURE (card-based model) ──────────────────────────────

    'ak_suppliers' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_suppliers (
  id             CHAR(36)     NOT NULL PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  supplier_type  VARCHAR(50)  NOT NULL DEFAULT 'other',
  contact_person VARCHAR(255)     NULL,
  phone          VARCHAR(100)     NULL,
  whatsapp       VARCHAR(100)     NULL,
  email          VARCHAR(255)     NULL,
  tax_no         VARCHAR(100)     NULL,
  address        TEXT             NULL,
  city           VARCHAR(100)     NULL,
  district       VARCHAR(100)     NULL,
  notes          TEXT             NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_suppliers_name         (name),
  KEY idx_suppliers_supplier_type (supplier_type),
  KEY idx_suppliers_is_active    (is_active),
  KEY idx_suppliers_created_at   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_customer_financial_entries' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_customer_financial_entries (
  id                        CHAR(36)       NOT NULL PRIMARY KEY,
  customer_id               CHAR(36)       NOT NULL,
  project_id                CHAR(36)       NOT NULL,
  title                     VARCHAR(255)   NOT NULL,
  notes                     TEXT               NULL,
  entry_date                DATE           NOT NULL,
  amount                    DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  paid_amount               DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  currency                  VARCHAR(10)    NOT NULL DEFAULT 'TRY',
  exchange_rate_to_try      DECIMAL(18,8)  NOT NULL DEFAULT 1.00000000,
  exchange_rate_source      VARCHAR(20)    NOT NULL DEFAULT 'default',
  exchange_rate_snapshot_at DATETIME           NULL,
  is_exchange_rate_manual   TINYINT(1)     NOT NULL DEFAULT 0,
  amount_try                DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  paid_amount_try           DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  account_type              VARCHAR(20)    NOT NULL DEFAULT 'resmi',
  payment_method            VARCHAR(40)    NOT NULL DEFAULT 'Nakit',
  status                    VARCHAR(50)    NOT NULL DEFAULT 'Planlanan',
  is_overdue                TINYINT(1)     NOT NULL DEFAULT 0,
  inflation_enabled         TINYINT(1)     NOT NULL DEFAULT 0,
  inflation_start_date      DATE               NULL,
  created_at                DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_cfe_customer    (customer_id),
  KEY idx_cfe_project     (project_id),
  KEY idx_cfe_entry_date  (entry_date),
  KEY idx_cfe_currency    (currency),
  KEY idx_cfe_account     (account_type),
  KEY idx_cfe_method      (payment_method),
  KEY idx_cfe_status      (status),
  KEY idx_cfe_created     (created_at),
  CONSTRAINT fk_cfe_customer FOREIGN KEY (customer_id) REFERENCES ak_customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cfe_project  FOREIGN KEY (project_id)  REFERENCES ak_projects(id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_employee_financial_entries' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_employee_financial_entries (
  id                        CHAR(36)       NOT NULL PRIMARY KEY,
  employee_id               CHAR(36)       NOT NULL,
  project_id                CHAR(36)       NOT NULL,
  title                     VARCHAR(255)   NOT NULL,
  notes                     TEXT               NULL,
  entry_date                DATE           NOT NULL,
  amount                    DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  paid_amount               DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  currency                  VARCHAR(10)    NOT NULL DEFAULT 'TRY',
  exchange_rate_to_try      DECIMAL(18,8)  NOT NULL DEFAULT 1.00000000,
  exchange_rate_source      VARCHAR(20)    NOT NULL DEFAULT 'default',
  exchange_rate_snapshot_at DATETIME           NULL,
  is_exchange_rate_manual   TINYINT(1)     NOT NULL DEFAULT 0,
  amount_try                DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  paid_amount_try           DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  account_type              VARCHAR(20)    NOT NULL DEFAULT 'resmi',
  payment_method            VARCHAR(40)    NOT NULL DEFAULT 'Nakit',
  status                    VARCHAR(50)    NOT NULL DEFAULT 'Planlanan',
  is_overdue                TINYINT(1)     NOT NULL DEFAULT 0,
  created_at                DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_efe_employee    (employee_id),
  KEY idx_efe_project     (project_id),
  KEY idx_efe_entry_date  (entry_date),
  KEY idx_efe_currency    (currency),
  KEY idx_efe_account     (account_type),
  KEY idx_efe_method      (payment_method),
  KEY idx_efe_status      (status),
  KEY idx_efe_created     (created_at),
  CONSTRAINT fk_efe_employee FOREIGN KEY (employee_id) REFERENCES ak_employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_efe_project  FOREIGN KEY (project_id)  REFERENCES ak_projects(id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_supplier_financial_entries' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_supplier_financial_entries (
  id                        CHAR(36)       NOT NULL PRIMARY KEY,
  supplier_id               CHAR(36)       NOT NULL,
  project_id                CHAR(36)       NOT NULL,
  title                     VARCHAR(255)   NOT NULL,
  notes                     TEXT               NULL,
  entry_date                DATE           NOT NULL,
  amount                    DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  paid_amount               DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  currency                  VARCHAR(10)    NOT NULL DEFAULT 'TRY',
  exchange_rate_to_try      DECIMAL(18,8)  NOT NULL DEFAULT 1.00000000,
  exchange_rate_source      VARCHAR(20)    NOT NULL DEFAULT 'default',
  exchange_rate_snapshot_at DATETIME           NULL,
  is_exchange_rate_manual   TINYINT(1)     NOT NULL DEFAULT 0,
  amount_try                DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  paid_amount_try           DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  account_type              VARCHAR(20)    NOT NULL DEFAULT 'resmi',
  payment_method            VARCHAR(40)    NOT NULL DEFAULT 'Nakit',
  status                    VARCHAR(50)    NOT NULL DEFAULT 'Planlanan',
  is_overdue                TINYINT(1)     NOT NULL DEFAULT 0,
  created_at                DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sfe_supplier    (supplier_id),
  KEY idx_sfe_project     (project_id),
  KEY idx_sfe_entry_date  (entry_date),
  KEY idx_sfe_currency    (currency),
  KEY idx_sfe_account     (account_type),
  KEY idx_sfe_method      (payment_method),
  KEY idx_sfe_status      (status),
  KEY idx_sfe_created     (created_at),
  CONSTRAINT fk_sfe_supplier FOREIGN KEY (supplier_id) REFERENCES ak_suppliers(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_sfe_project  FOREIGN KEY (project_id)  REFERENCES ak_projects(id)   ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_expense_card_financial_entries' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_expense_card_financial_entries (
  id                        CHAR(36)       NOT NULL PRIMARY KEY,
  expense_card_id           CHAR(36)       NOT NULL,
  project_id                CHAR(36)       NOT NULL,
  title                     VARCHAR(255)   NOT NULL,
  notes                     TEXT               NULL,
  entry_date                DATE           NOT NULL,
  amount                    DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  paid_amount               DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  currency                  VARCHAR(10)    NOT NULL DEFAULT 'TRY',
  exchange_rate_to_try      DECIMAL(18,8)  NOT NULL DEFAULT 1.00000000,
  exchange_rate_source      VARCHAR(20)    NOT NULL DEFAULT 'default',
  exchange_rate_snapshot_at DATETIME           NULL,
  is_exchange_rate_manual   TINYINT(1)     NOT NULL DEFAULT 0,
  amount_try                DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  paid_amount_try           DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  account_type              VARCHAR(20)    NOT NULL DEFAULT 'resmi',
  payment_method            VARCHAR(40)    NOT NULL DEFAULT 'Nakit',
  status                    VARCHAR(50)    NOT NULL DEFAULT 'Planlanan',
  is_overdue                TINYINT(1)     NOT NULL DEFAULT 0,
  created_at                DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_ecfe_expense_card (expense_card_id),
  KEY idx_ecfe_project      (project_id),
  KEY idx_ecfe_entry_date   (entry_date),
  KEY idx_ecfe_currency     (currency),
  KEY idx_ecfe_account      (account_type),
  KEY idx_ecfe_method       (payment_method),
  KEY idx_ecfe_status       (status),
  KEY idx_ecfe_created      (created_at),
  CONSTRAINT fk_ecfe_expense_card FOREIGN KEY (expense_card_id) REFERENCES ak_expense_cards(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ecfe_project      FOREIGN KEY (project_id)      REFERENCES ak_projects(id)      ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    // ── LEGACY / DEPRECATED (retained for schema compatibility, not used in active finance math) ──

    'ak_project_expense_transactions' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_project_expense_transactions (
  id                         CHAR(36)      NOT NULL PRIMARY KEY,
  project_id                 CHAR(36)      NOT NULL,
  expense_item_id            CHAR(36)          NULL,
  expense_item_name_snapshot VARCHAR(255)  NOT NULL,
  amount                     DECIMAL(14,4) NOT NULL,
  currency                   VARCHAR(10)   NOT NULL DEFAULT 'TRY',
  exchange_rate_snapshot     DECIMAL(18,8)     NULL,
  exchange_rate_overridden   TINYINT(1)    NOT NULL DEFAULT 0,
  expense_date               DATE          NOT NULL,
  created_at                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_pet_project      (project_id),
  KEY idx_pet_expense_item (expense_item_id),
  KEY idx_pet_date         (expense_date),
  KEY idx_pet_project_date (project_id, expense_date),
  KEY idx_pet_currency     (currency),
  CONSTRAINT fk_pet_project      FOREIGN KEY (project_id)      REFERENCES ak_projects(id)      ON DELETE RESTRICT,
  CONSTRAINT fk_pet_expense_item FOREIGN KEY (expense_item_id) REFERENCES ak_expense_cards(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_financial_entries' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_financial_entries (
  id CHAR(36) NOT NULL PRIMARY KEY,
  project_id CHAR(36) NULL,
  entry_date DATE NOT NULL,
  business_transaction_id CHAR(36) NULL,
  event_type VARCHAR(50) NULL,
  source_type VARCHAR(50) NULL,
  source_id CHAR(36) NULL,
  source_version VARCHAR(30) NULL,
  payment_plan_id CHAR(36) NULL,
  parent_entry_id CHAR(36) NULL,
  counterparty_type VARCHAR(30) NULL,
  counterparty_id CHAR(36) NULL,
  account_type VARCHAR(20) NULL,
  allocation_scope VARCHAR(30) NULL,
  allocation_note TEXT NULL,
  transaction_date DATE NULL,
  due_date DATE NULL,
  exchange_rate DECIMAL(18,8) NULL,
  base_amount DECIMAL(18,2) NULL,
  category_code VARCHAR(80) NULL,
  subcategory_code VARCHAR(80) NULL,
  document_id CHAR(36) NULL,
  migration_confidence VARCHAR(30) NULL,
  reconciliation_status VARCHAR(30) NULL,
  archived_at DATETIME NULL,
  archived_by CHAR(36) NULL,
  canceled_at DATETIME NULL,
  canceled_by CHAR(36) NULL,
  cancellation_reason TEXT NULL,
  reversal_entry_id CHAR(36) NULL,
  card_type VARCHAR(50) NOT NULL,
  customer_id CHAR(36) NULL,
  employee_id CHAR(36) NULL,
  expense_card_id CHAR(36) NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  currency_tag VARCHAR(10) NOT NULL DEFAULT 'TRY',
  group_tag VARCHAR(50) NOT NULL DEFAULT 'Resmi',
  direction VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Gerçekleşti',
  document_url TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_financial_entries_project_date (project_id, entry_date),
  KEY idx_financial_entries_card_type (card_type),
  KEY idx_financial_entries_customer_id (customer_id),
  KEY idx_financial_entries_employee_id (employee_id),
  KEY idx_financial_entries_expense_card_id (expense_card_id),
  KEY idx_financial_entries_direction (direction),
  KEY idx_financial_entries_status (status),
  KEY idx_financial_entries_group_tag (group_tag),
  KEY idx_financial_entries_currency_tag (currency_tag),
  KEY idx_financial_entries_source (source_type, source_id),
  KEY idx_financial_entries_business_transaction (business_transaction_id),
  KEY idx_financial_entries_event_type (event_type),
  KEY idx_financial_entries_payment_plan (payment_plan_id),
  KEY idx_financial_entries_counterparty (counterparty_type, counterparty_id),
  KEY idx_financial_entries_project_transaction (project_id, transaction_date),
  KEY idx_financial_entries_account_type (account_type),
  KEY idx_financial_entries_reconciliation (reconciliation_status),
  CONSTRAINT fk_financial_entries_project FOREIGN KEY (project_id) REFERENCES ak_projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_financial_entries_customer FOREIGN KEY (customer_id) REFERENCES ak_customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_financial_entries_employee FOREIGN KEY (employee_id) REFERENCES ak_employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_financial_entries_expense_card FOREIGN KEY (expense_card_id) REFERENCES ak_expense_cards(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_payment_plan_settlements' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_payment_plan_settlements (
  id CHAR(36) NOT NULL PRIMARY KEY,
  payment_plan_id CHAR(36) NOT NULL,
  financial_entry_id CHAR(36) NOT NULL,
  allocated_amount DECIMAL(18,2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  account_type VARCHAR(20) NOT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reversed_at DATETIME NULL,
  reversed_by CHAR(36) NULL,
  reversal_reason TEXT NULL,
  active_pair_guard TINYINT
    GENERATED ALWAYS AS (CASE WHEN reversed_at IS NULL THEN 1 ELSE NULL END) STORED,
  KEY idx_plan_settlements_plan (payment_plan_id),
  KEY idx_plan_settlements_entry (financial_entry_id),
  KEY idx_plan_settlements_currency (currency),
  KEY idx_plan_settlements_account_type (account_type),
  UNIQUE KEY uq_plan_settlements_active_pair (
    payment_plan_id,
    financial_entry_id,
    active_pair_guard
  ),
  CONSTRAINT chk_plan_settlements_positive CHECK (allocated_amount > 0),
  CONSTRAINT fk_plan_settlements_plan
    FOREIGN KEY (payment_plan_id) REFERENCES ak_payment_plans(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_plan_settlements_entry
    FOREIGN KEY (financial_entry_id) REFERENCES ak_financial_entries(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_plan_settlements_created_by
    FOREIGN KEY (created_by) REFERENCES ak_admin_users(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_plan_settlements_reversed_by
    FOREIGN KEY (reversed_by) REFERENCES ak_admin_users(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_cookie_consents' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_cookie_consents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  consent_status VARCHAR(50) NOT NULL,
  necessary TINYINT(1) NOT NULL DEFAULT 1,
  analytics TINYINT(1) NOT NULL DEFAULT 0,
  marketing TINYINT(1) NOT NULL DEFAULT 0,
  user_agent TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_inflation_indices' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_inflation_indices (
  id                     CHAR(36)      NOT NULL PRIMARY KEY,
  index_type             VARCHAR(20)   NOT NULL,
  period_year            INT           NOT NULL,
  period_month           INT           NOT NULL,
  index_value            DECIMAL(12,4) NULL,
  monthly_change_percent DECIMAL(8,4)  NULL,
  annual_change_percent  DECIMAL(8,4)  NULL,
  source                 VARCHAR(100)  NULL,
  created_at             DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_inflation_indices_type_period (index_type, period_year, period_month),
  KEY idx_inflation_indices_type (index_type),
  KEY idx_inflation_indices_year (period_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_media_albums' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_media_albums (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  color       VARCHAR(20)      NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  is_favorite TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_media_albums_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_media_album_items' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_media_album_items (
  album_id CHAR(36)     NOT NULL,
  media_id VARCHAR(255) NOT NULL,
  PRIMARY KEY (album_id, media_id),
  KEY idx_media_album_items_media (media_id),
  CONSTRAINT fk_media_album_items_album FOREIGN KEY (album_id)
    REFERENCES ak_media_albums(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_government_progress_payments' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_government_progress_payments (
  id                                  CHAR(36)      NOT NULL PRIMARY KEY,
  project_id                          CHAR(36)      NULL,
  customer_id                         CHAR(36)      NULL,
  source_customer_financial_entry_id  CHAR(36)      NULL,
  title                               VARCHAR(255)  NOT NULL,
  stage                               VARCHAR(50)   NOT NULL DEFAULT 'Belirtilmemiş',
  stage_percentage                    DECIMAL(5,2)  NOT NULL DEFAULT 0,
  planned_amount_try                  DECIMAL(15,2) NOT NULL DEFAULT 0,
  paid_amount_try                     DECIMAL(15,2) NOT NULL DEFAULT 0,
  due_date                            DATE          NULL,
  paid_date                           DATE          NULL,
  status                              VARCHAR(20)   NOT NULL DEFAULT 'planned',
  notes                               TEXT          NULL,
  created_at                          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_gpp_project_id  (project_id),
  KEY idx_gpp_customer_id (customer_id),
  KEY idx_gpp_stage       (stage),
  KEY idx_gpp_status      (status),
  KEY idx_gpp_due_date    (due_date),
  KEY idx_gpp_source_cfe  (source_customer_financial_entry_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_government_progress_payment_breakdowns' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_government_progress_payment_breakdowns (
  id                              CHAR(36)       NOT NULL PRIMARY KEY,
  government_progress_payment_id  CHAR(36)       NOT NULL,
  stage                           VARCHAR(50)    NOT NULL,
  stage_percentage                DECIMAL(5,2)   NOT NULL DEFAULT 0,
  planned_amount_try              DECIMAL(15,2)  NOT NULL DEFAULT 0,
  paid_amount_try                 DECIMAL(15,2)  NOT NULL DEFAULT 0,
  due_date                        DATE           NULL,
  paid_date                       DATE           NULL,
  status                          VARCHAR(20)    NOT NULL DEFAULT 'planned',
  notes                           TEXT           NULL,
  sort_order                      INT            NOT NULL DEFAULT 0,
  created_at                      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_gppb_payment_id (government_progress_payment_id),
  KEY idx_gppb_stage      (stage),
  KEY idx_gppb_status     (status),
  KEY idx_gppb_due_date   (due_date),
  KEY idx_gppb_sort       (sort_order),
  CONSTRAINT fk_gppb_payment FOREIGN KEY (government_progress_payment_id)
    REFERENCES ak_government_progress_payments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_government_progress_payment_collections' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_government_progress_payment_collections (
  id                              CHAR(36)       NOT NULL PRIMARY KEY,
  government_progress_payment_id  CHAR(36)       NOT NULL,
  breakdown_id                    CHAR(36)       NULL,
  project_id                      CHAR(36)       NULL,
  customer_id                     CHAR(36)       NULL,
  title                           VARCHAR(255)   NOT NULL,
  collection_date                 DATE           NOT NULL,
  amount_try                      DECIMAL(15,2)  NOT NULL DEFAULT 0,
  notes                           TEXT           NULL,
  created_at                      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_gppc_payment_id      (government_progress_payment_id),
  KEY idx_gppc_breakdown_id    (breakdown_id),
  KEY idx_gppc_collection_date (collection_date),
  KEY idx_gppc_project_id      (project_id),
  KEY idx_gppc_customer_id     (customer_id),
  CONSTRAINT fk_gppc_payment   FOREIGN KEY (government_progress_payment_id)
    REFERENCES ak_government_progress_payments (id) ON DELETE CASCADE,
  CONSTRAINT fk_gppc_breakdown FOREIGN KEY (breakdown_id)
    REFERENCES ak_government_progress_payment_breakdowns (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
];

try {
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    echo "<pre>\nConnected to {$database} on {$host}.\n\n";

    $createdCount = 0;
    $existingCount = 0;
    foreach ($tables as $tableName => $sql) {
        $exists = tableExists($pdo, $database, $tableName);
        $pdo->exec($sql);
        $exists ? $existingCount++ : $createdCount++;
        echo ($exists ? 'Already existed: ' : 'Created: ') . $tableName . "\n";
    }

    $siteSettingsSeedStatus = seedSiteSettings($pdo);

    echo "\nSchema installation finished.\n";
    echo "Connected database: {$database}\n";
    echo "Created table count: {$createdCount}\n";
    echo "Already existing table count: {$existingCount}\n";
    echo "Expected table count: " . count($tables) . "\n";
    echo "Site settings seed status: {$siteSettingsSeedStatus}\n";
    echo "Important: delete install-schema.php immediately after a successful run.\n</pre>";
} catch (Throwable $exception) {
    http_response_code(500);
    echo "<pre>Schema installation failed:\n" . htmlspecialchars($exception->getMessage(), ENT_QUOTES, 'UTF-8') . "</pre>";
}

function tableExists(PDO $pdo, string $database, string $tableName): bool
{
    $statement = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = :database AND table_name = :table'
    );
    $statement->execute([
        'database' => $database,
        'table' => $tableName,
    ]);

    return (int) $statement->fetchColumn() > 0;
}

function seedSiteSettings(PDO $pdo): string
{
    $statement = $pdo->query('SELECT COUNT(*) FROM ak_site_settings');
    if ((int) $statement->fetchColumn() > 0) {
        return 'skipped; ak_site_settings already has data';
    }

    $siteSettingsId = uuidv4();
    $statement = $pdo->prepare(<<<'SQL'
INSERT INTO ak_site_settings (
  id,
  address,
  footer_description,
  hero_subtitle,
  whatsapp_message,
  seo_description
) VALUES (
  :id,
  :address,
  :footer_description,
  :hero_subtitle,
  :whatsapp_message,
  :seo_description
)
SQL);

    $statement->execute([
        'id' => $siteSettingsId,
        'address' => 'Molla Gürani Mah. Sarı Musa Sk. NO:49/A 34349 Fatih/İstanbul/Türkiye',
        'footer_description' => 'Akinal İnşaat; kentsel dönüşüm ve inşaat projelerinde güvenilir, planlı ve teknik çözümler sunar.',
        'hero_subtitle' => 'Akinal İnşaat olarak kentsel dönüşüm, kat karşılığı inşaat ve anahtar teslim projelerde; planlama, ruhsat, uygulama ve teslim süreçlerini profesyonel şekilde yönetiyoruz.',
        'whatsapp_message' => 'Merhaba, kentsel dönüşüm / inşaat hizmetleriniz hakkında bilgi almak istiyorum.',
        'seo_description' => 'Akinal İnşaat; kentsel dönüşüm, kat karşılığı inşaat, anahtar teslim inşaat ve proje geliştirme alanlarında güvenilir çözümler sunar.',
    ]);

    return 'inserted default ak_site_settings row';
}

function uuidv4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

