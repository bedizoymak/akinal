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

$tables = [
    'ak_admin_users' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_admin_users (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) NOT NULL,
  email_lower VARCHAR(255) GENERATED ALWAYS AS (LOWER(email)) STORED,
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
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
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
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  role VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_roles_user_role (user_id, role),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES ak_admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_projects' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_projects (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
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
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_projects_slug (slug),
  KEY idx_projects_published (is_published, sort_order),
  KEY idx_projects_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_project_images' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_project_images (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
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
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
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
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
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
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
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
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
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
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
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
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  customer_id CHAR(36) NULL,
  project_id CHAR(36) NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  due_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Bekliyor',
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payment_plans_customer (customer_id),
  KEY idx_payment_plans_project (project_id),
  KEY idx_payment_plans_due_date (due_date),
  CONSTRAINT fk_payment_plans_customer FOREIGN KEY (customer_id) REFERENCES ak_customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_plans_project FOREIGN KEY (project_id) REFERENCES ak_projects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_payments' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_payments (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  customer_id CHAR(36) NULL,
  project_id CHAR(36) NULL,
  payment_plan_id CHAR(36) NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  payment_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  payment_method VARCHAR(100) NOT NULL DEFAULT 'Nakit',
  description TEXT NULL,
  document_url TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payments_customer (customer_id),
  KEY idx_payments_project (project_id),
  KEY idx_payments_plan (payment_plan_id),
  CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES ak_customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_project FOREIGN KEY (project_id) REFERENCES ak_projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_plan FOREIGN KEY (payment_plan_id) REFERENCES ak_payment_plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_expenses' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_expenses (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  project_id CHAR(36) NULL,
  customer_id CHAR(36) NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Diğer',
  amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  expense_date DATE NOT NULL DEFAULT (CURRENT_DATE),
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
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  customer_id CHAR(36) NOT NULL,
  note TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_customer_notes_customer (customer_id),
  CONSTRAINT fk_customer_notes_customer FOREIGN KEY (customer_id) REFERENCES ak_customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_documents' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_documents (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  customer_id CHAR(36) NULL,
  project_id CHAR(36) NULL,
  title VARCHAR(255) NOT NULL,
  document_type VARCHAR(100) NOT NULL DEFAULT 'Diğer',
  file_url TEXT NOT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_documents_customer (customer_id),
  KEY idx_documents_project (project_id),
  CONSTRAINT fk_documents_customer FOREIGN KEY (customer_id) REFERENCES ak_customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_documents_project FOREIGN KEY (project_id) REFERENCES ak_projects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_notifications' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_notifications (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(100) NOT NULL DEFAULT 'Genel',
  priority VARCHAR(50) NOT NULL DEFAULT 'Orta',
  related_customer_id CHAR(36) NULL,
  related_project_id CHAR(36) NULL,
  related_payment_plan_id CHAR(36) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_created_at (created_at DESC),
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
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(100) NULL,
  role VARCHAR(100) NULL,
  notes TEXT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Aktif',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_expense_cards' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_expense_cards (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NULL,
  description TEXT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Aktif',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_financial_entries' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_financial_entries (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  project_id CHAR(36) NULL,
  entry_date DATE NOT NULL DEFAULT (CURRENT_DATE),
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
  CHECK (card_type IN ('customer', 'employee', 'expense')),
  CHECK (currency_tag IN ('TRY', 'USD', 'EUR')),
  CHECK (group_tag IN ('Resmi', 'Gayri Resmi')),
  CHECK (direction IN ('Gelir', 'Gider')),
  CHECK (status IN ('Planlandı', 'Gerçekleşti', 'İptal')),
  CHECK (amount > 0),
  KEY idx_financial_entries_project_date (project_id, entry_date),
  KEY idx_financial_entries_card_type (card_type),
  KEY idx_financial_entries_customer_id (customer_id),
  KEY idx_financial_entries_employee_id (employee_id),
  KEY idx_financial_entries_expense_card_id (expense_card_id),
  KEY idx_financial_entries_direction (direction),
  KEY idx_financial_entries_status (status),
  KEY idx_financial_entries_group_tag (group_tag),
  KEY idx_financial_entries_currency_tag (currency_tag),
  CONSTRAINT fk_financial_entries_project FOREIGN KEY (project_id) REFERENCES ak_projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_financial_entries_customer FOREIGN KEY (customer_id) REFERENCES ak_customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_financial_entries_employee FOREIGN KEY (employee_id) REFERENCES ak_employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_financial_entries_expense_card FOREIGN KEY (expense_card_id) REFERENCES ak_expense_cards(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,

    'ak_cookie_consents' => <<<'SQL'
CREATE TABLE IF NOT EXISTS ak_cookie_consents (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  consent_status VARCHAR(50) NOT NULL,
  necessary TINYINT(1) NOT NULL DEFAULT 1,
  analytics TINYINT(1) NOT NULL DEFAULT 0,
  marketing TINYINT(1) NOT NULL DEFAULT 0,
  user_agent TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (consent_status IN ('accepted', 'rejected', 'managed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
];

try {
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    echo "<pre>\nConnected to {$database} on {$host}.\n\n";

    foreach ($tables as $tableName => $sql) {
        $exists = tableExists($pdo, $database, $tableName);
        $pdo->exec($sql);
        echo ($exists ? 'Already existed: ' : 'Created: ') . $tableName . "\n";
    }

    seedSiteSettings($pdo);

    echo "\nSchema installation finished.\n";
    echo "Remove or protect this installer after a successful run.\n</pre>";
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

function seedSiteSettings(PDO $pdo): void
{
    $statement = $pdo->query('SELECT COUNT(*) FROM ak_site_settings');
    if ((int) $statement->fetchColumn() > 0) {
        return;
    }

    $pdo->exec(<<<'SQL'
INSERT INTO ak_site_settings (
  id,
  address,
  footer_description,
  hero_subtitle,
  whatsapp_message,
  seo_description
) VALUES (
  UUID(),
  'Molla Gürani Mah. Sarı Musa Sk. NO:49/A 34349 Fatih/İstanbul/Türkiye',
  'Akinal İnşaat; kentsel dönüşüm ve inşaat projelerinde güvenilir, planlı ve teknik çözümler sunar.',
  'Akinal İnşaat olarak kentsel dönüşüm, kat karşılığı inşaat ve anahtar teslim projelerde; planlama, ruhsat, uygulama ve teslim süreçlerini profesyonel şekilde yönetiyoruz.',
  'Merhaba, kentsel dönüşüm / inşaat hizmetleriniz hakkında bilgi almak istiyorum.',
  'Akinal İnşaat; kentsel dönüşüm, kat karşılığı inşaat, anahtar teslim inşaat ve proje geliştirme alanlarında güvenilir çözümler sunar.'
)
SQL);

    echo "\nSeeded default ak_site_settings row.\n";
}
