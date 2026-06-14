<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only.\n");
}

const CLASSIFIER_VERSION = '2026-06-14-001';
const CLASSIFIER_ALLOWED_SQL = ['SELECT', 'WITH'];

$options = getopt('', ['help', 'config:', 'output:', 'no-output', 'pretty']);
if (isset($options['help']) || (!isset($options['config']) && !classifier_has_env_config())) {
    classifier_print_help();
    exit(0);
}

try {
    $config = isset($options['config'])
        ? classifier_load_config((string) $options['config'])
        : classifier_load_env_config();
    $pdo = classifier_connect_read_only($config);
    $queries = classifier_load_queries(__DIR__ . '/sql/canonical_cashflow_classifier_queries.sql');
    $data = classifier_fetch_all($pdo, $queries);
    $report = classifier_build_report($data);
    $json = json_encode(
        $report,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | (isset($options['pretty']) ? JSON_PRETTY_PRINT : 0)
    );
    if ($json === false) {
        throw new RuntimeException('Could not encode classification report.');
    }

    fwrite(STDOUT, $json . PHP_EOL);
    if (!isset($options['no-output'])) {
        $output = isset($options['output'])
            ? (string) $options['output']
            : __DIR__ . '/output/canonical-cashflow-' . gmdate('Ymd-His') . '.classification.json';
        classifier_write_report($output, $json);
        fwrite(STDERR, "Sensitive report written to ignored path: {$output}\n");
    }
} catch (Throwable $exception) {
    fwrite(STDERR, 'Classification failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}

function classifier_print_help(): void
{
    echo <<<'TEXT'
Canonical cashflow classifier (CLI, read-only)

Usage:
  php tools/canonical-cashflow-classifier.php --help
  php tools/canonical-cashflow-classifier.php --config=C:\path\to\readonly-config.php --pretty
  php tools/canonical-cashflow-classifier.php --no-output --pretty

Config file must return:
  <?php return ['host' => 'localhost', 'database' => '...', 'user' => 'readonly', 'password' => '...'];

Environment alternative:
  AK_CLASSIFIER_DB_HOST
  AK_CLASSIFIER_DB_NAME
  AK_CLASSIFIER_DB_USER
  AK_CLASSIFIER_DB_PASS

Safety:
  - No database connection is attempted when configuration is absent.
  - The session starts a read-only transaction before queries run.
  - The query library accepts SELECT/WITH statements only.
  - JSON exports default to tools/output/, which is ignored by Git.
TEXT;
    echo PHP_EOL;
}

function classifier_has_env_config(): bool
{
    foreach (['AK_CLASSIFIER_DB_HOST', 'AK_CLASSIFIER_DB_NAME', 'AK_CLASSIFIER_DB_USER'] as $name) {
        if (trim((string) getenv($name)) === '') {
            return false;
        }
    }
    return true;
}

function classifier_load_config(string $path): array
{
    $resolved = realpath($path);
    if ($resolved === false || !is_file($resolved)) {
        throw new InvalidArgumentException('Classifier config file was not found.');
    }
    $config = require $resolved;
    if (!is_array($config)) {
        throw new InvalidArgumentException('Classifier config must return an array.');
    }
    return classifier_validate_config($config);
}

function classifier_load_env_config(): array
{
    return classifier_validate_config([
        'host' => getenv('AK_CLASSIFIER_DB_HOST'),
        'database' => getenv('AK_CLASSIFIER_DB_NAME'),
        'user' => getenv('AK_CLASSIFIER_DB_USER'),
        'password' => getenv('AK_CLASSIFIER_DB_PASS') ?: '',
    ]);
}

function classifier_validate_config(array $config): array
{
    foreach (['host', 'database', 'user'] as $field) {
        if (trim((string) ($config[$field] ?? '')) === '') {
            throw new InvalidArgumentException("Missing classifier config field: {$field}");
        }
    }
    return [
        'host' => (string) $config['host'],
        'database' => (string) $config['database'],
        'user' => (string) $config['user'],
        'password' => (string) ($config['password'] ?? ''),
    ];
}

function classifier_connect_read_only(array $config): PDO
{
    $dsn = "mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4";
    $pdo = new PDO($dsn, $config['user'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec('SET SESSION TRANSACTION READ ONLY');
    $pdo->beginTransaction();
    return $pdo;
}

function classifier_load_queries(string $path): array
{
    $sql = file_get_contents($path);
    if ($sql === false) {
        throw new RuntimeException('Classifier query library could not be read.');
    }
    $queries = [];
    $parts = preg_split('/(?=^-- name:\s*[a-z_]+\s*$)/mi', $sql) ?: [];
    foreach ($parts as $part) {
        if (!preg_match('/^-- name:\s*([a-z_]+)\s*$/mi', $part, $match)) {
            continue;
        }
        $name = strtolower($match[1]);
        $statement = trim(preg_replace('/^\s*--.*$/m', '', $part) ?? '');
        $statement = rtrim($statement, ";\r\n\t ");
        $first = strtoupper((string) strtok(ltrim($statement), " \t\r\n"));
        if (!in_array($first, CLASSIFIER_ALLOWED_SQL, true)) {
            throw new RuntimeException("Unsafe classifier query rejected: {$name}");
        }
        if (preg_match('/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE|REPLACE|CALL|EXECUTE|PREPARE)\b/i', $statement)) {
            throw new RuntimeException("Forbidden SQL keyword in classifier query: {$name}");
        }
        $queries[$name] = $statement;
    }
    foreach (['payments', 'expenses', 'plans', 'entries', 'settlements', 'customers', 'employees', 'expense_cards', 'projects'] as $required) {
        if (!isset($queries[$required])) {
            throw new RuntimeException("Missing classifier query: {$required}");
        }
    }
    return $queries;
}

function classifier_fetch_all(PDO $pdo, array $queries): array
{
    $result = [];
    foreach ($queries as $name => $sql) {
        try {
            $result[$name] = $pdo->query($sql)->fetchAll() ?: [];
        } catch (PDOException $exception) {
            if ($name === 'settlements' && ($exception->errorInfo[1] ?? null) === 1146) {
                $result[$name] = [];
                continue;
            }
            throw $exception;
        }
    }
    $pdo->rollBack();
    return $result;
}

function classifier_build_report(array $data): array
{
    $entries = $data['entries'];
    $payments = classifier_classify_payments($data['payments'], $entries);
    $expenses = classifier_classify_expenses($data['expenses'], $entries);
    $plans = classifier_classify_plans($data['plans'], $data['payments'], $entries, $data['settlements']);
    $ledger = classifier_classify_entries($entries, $payments, $expenses);
    $blockers = array_sum([
        classifier_count_flag($payments, 'blocker'),
        classifier_count_flag($expenses, 'blocker'),
        classifier_count_flag($plans, 'blocker'),
        classifier_count_flag($ledger, 'blocker'),
    ]);
    $manual = array_sum([
        classifier_count_flag($payments, 'manual_review'),
        classifier_count_flag($expenses, 'manual_review'),
        classifier_count_flag($plans, 'manual_review'),
        classifier_count_flag($ledger, 'manual_review'),
    ]);

    return [
        'meta' => [
            'classifier_version' => CLASSIFIER_VERSION,
            'generated_at_utc' => gmdate(DATE_ATOM),
            'mode' => 'read_only',
            'contains_sensitive_data' => true,
        ],
        'summary' => [
            'source_row_counts' => [
                'payments' => count($data['payments']),
                'expenses' => count($data['expenses']),
                'payment_plans' => count($data['plans']),
                'financial_entries' => count($entries),
                'settlements' => count($data['settlements']),
            ],
            'classification_counts' => [
                'payments' => classifier_count_classes($payments),
                'expenses' => classifier_count_classes($expenses),
                'plans' => classifier_count_classes($plans),
                'ledger' => classifier_count_classes($ledger),
            ],
            'amount_totals' => classifier_amount_totals($data),
            'blocker_count' => $blockers,
            'manual_review_count' => $manual,
        ],
        'legacy_payments' => $payments,
        'legacy_expenses' => $expenses,
        'payment_plans' => $plans,
        'ledger_entries' => $ledger,
        'migration_readiness' => [
            'status' => $blockers > 0 ? 'blocked' : ($manual > 0 ? 'conditional' : 'ready'),
            'blocker_count' => $blockers,
            'manual_review_count' => $manual,
        ],
    ];
}

function classifier_classify_payments(array $payments, array $entries): array
{
    $result = [];
    foreach ($payments as $payment) {
        $exact = array_values(array_filter($entries, static fn(array $entry): bool =>
            ($entry['source_type'] ?? null) === 'legacy_payment' && ($entry['source_id'] ?? null) === $payment['id']
        ));
        $candidates = array_values(array_filter($entries, static function (array $entry) use ($payment): bool {
            return ($entry['card_type'] ?? null) === 'customer'
                && ($entry['customer_id'] ?? null) === ($payment['customer_id'] ?? null)
                && ($entry['direction'] ?? null) === 'Gelir'
                && ($entry['status'] ?? null) === 'Gerçekleşti'
                && ($entry['currency_tag'] ?? null) === 'TRY'
                && classifier_money($entry['amount'] ?? 0) === classifier_money($payment['amount'] ?? 0)
                && abs(classifier_day_diff($entry['entry_date'] ?? '', $payment['payment_date'] ?? '')) <= 1;
        }));
        $class = count($exact) === 1 ? 'exact' : (count($exact) > 1 || count($candidates) > 1 ? 'ambiguous' : (count($candidates) === 1 ? 'probable' : 'no_match'));
        $matched = $exact[0] ?? $candidates[0] ?? null;
        $projectMismatch = $matched !== null && ($matched['project_id'] ?? null) !== ($payment['project_id'] ?? null);
        $expectedGroup = ($payment['account_type'] ?? null) === 'gayri_resmi' ? 'Gayri Resmi' : 'Resmi';
        $accountMismatch = $matched !== null && ($matched['group_tag'] ?? null) !== $expectedGroup;
        $manual = $class !== 'exact' || $projectMismatch || $accountMismatch;
        $result[] = [
            'id' => $payment['id'],
            'classification' => $class,
            'candidate_entry_ids' => array_values(array_unique(array_column(array_merge($exact, $candidates), 'id'))),
            'amount' => (float) $payment['amount'],
            'currency_assumption' => 'TRY',
            'project_mismatch' => $projectMismatch,
            'account_mismatch' => $accountMismatch,
            'unsupported_or_null_currency_assumption' => false,
            'manual_review' => $manual,
            'blocker' => $class === 'ambiguous' || $projectMismatch || $accountMismatch,
        ];
    }
    return $result;
}

function classifier_classify_expenses(array $expenses, array $entries): array
{
    $result = [];
    foreach ($expenses as $expense) {
        $exact = array_values(array_filter($entries, static fn(array $entry): bool =>
            ($entry['source_type'] ?? null) === 'legacy_expense' && ($entry['source_id'] ?? null) === $expense['id']
        ));
        $candidates = array_values(array_filter($entries, static function (array $entry) use ($expense): bool {
            return ($entry['direction'] ?? null) === 'Gider'
                && ($entry['status'] ?? null) === 'Gerçekleşti'
                && ($entry['currency_tag'] ?? null) === 'TRY'
                && classifier_money($entry['amount'] ?? 0) === classifier_money($expense['amount'] ?? 0)
                && abs(classifier_day_diff($entry['entry_date'] ?? '', $expense['expense_date'] ?? '')) <= 1
                && mb_strtolower(trim((string) ($entry['title'] ?? ''))) === mb_strtolower(trim((string) ($expense['title'] ?? '')));
        }));
        $class = count($exact) === 1 ? 'exact' : (count($exact) > 1 || count($candidates) > 1 ? 'ambiguous' : (count($candidates) === 1 ? 'probable' : 'no_match'));
        $matched = $exact[0] ?? $candidates[0] ?? null;
        $projectMismatch = $matched !== null && ($matched['project_id'] ?? null) !== ($expense['project_id'] ?? null);
        $categoryUncertain = trim((string) ($expense['category'] ?? '')) === '' || ($expense['category'] ?? null) === 'Diğer';
        $result[] = [
            'id' => $expense['id'],
            'classification' => $class,
            'candidate_entry_ids' => array_values(array_unique(array_column(array_merge($exact, $candidates), 'id'))),
            'amount' => (float) $expense['amount'],
            'project_mismatch' => $projectMismatch,
            'assumed_account_type' => 'resmi',
            'assumed_currency' => 'TRY',
            'category_uncertainty' => $categoryUncertain,
            'manual_review' => true,
            'blocker' => $class === 'ambiguous' || $projectMismatch,
        ];
    }
    return $result;
}

function classifier_classify_plans(array $plans, array $payments, array $entries, array $settlements): array
{
    $result = [];
    $today = gmdate('Y-m-d');
    foreach ($plans as $plan) {
        $owners = array_values(array_filter([
            $plan['customer_id'] ?? null,
            $plan['employee_id'] ?? null,
            $plan['expense_card_id'] ?? null,
        ], static fn($value): bool => trim((string) $value) !== ''));
        $linkedPayments = array_values(array_filter($payments, static fn(array $payment): bool =>
            ($payment['payment_plan_id'] ?? null) === $plan['id']
        ));
        $linkedSettlements = array_values(array_filter($settlements, static fn(array $settlement): bool =>
            ($settlement['payment_plan_id'] ?? null) === $plan['id'] && empty($settlement['reversed_at'])
        ));
        $settled = array_sum(array_map(static fn(array $row): float => (float) $row['allocated_amount'], $linkedSettlements));
        $probableEntries = array_values(array_filter($entries, static function (array $entry) use ($plan): bool {
            $ownerMatch = (($plan['customer_id'] ?? null) && ($entry['customer_id'] ?? null) === $plan['customer_id'])
                || (($plan['employee_id'] ?? null) && ($entry['employee_id'] ?? null) === $plan['employee_id'])
                || (($plan['expense_card_id'] ?? null) && ($entry['expense_card_id'] ?? null) === $plan['expense_card_id']);
            return $ownerMatch
                && classifier_money($entry['amount'] ?? 0) === classifier_money($plan['amount'] ?? 0)
                && ($entry['status'] ?? null) === 'Gerçekleşti';
        }));
        $manualPaid = (float) ($plan['paid_amount'] ?? 0) > 0 || ($plan['status'] ?? null) === 'Ödendi';
        $remaining = max(0.0, (float) $plan['amount'] - max($settled, (float) ($plan['paid_amount'] ?? 0)));
        $maturityProblem = classifier_maturity_problem($plan, $today);
        $missingOwner = count($owners) === 0;
        $multipleOwner = count($owners) > 1;
        $paidWithoutEvidence = $manualPaid && count($linkedPayments) === 0 && count($linkedSettlements) === 0 && count($probableEntries) === 0;
        $blocker = $missingOwner || $multipleOwner || $paidWithoutEvidence || $maturityProblem;
        $result[] = [
            'id' => $plan['id'],
            'classification' => $blocker ? 'blocker' : ($manualPaid || count($probableEntries) > 0 ? 'manual_review' : 'classified'),
            'owner_type' => ($plan['customer_id'] ?? null) ? 'receivable' : 'payable',
            'active' => !in_array($plan['status'] ?? null, ['İptal'], true),
            'manual_paid_state' => $manualPaid,
            'paid_without_realized_evidence' => $paidWithoutEvidence,
            'partial_overdue_remaining' => ($plan['due_date'] ?? '') < $today && $remaining > 0 && ((float) ($plan['paid_amount'] ?? 0) > 0 || $settled > 0),
            'maturity_problem' => $maturityProblem,
            'missing_project' => empty($plan['project_id']),
            'missing_owner' => $missingOwner,
            'multiple_owner' => $multipleOwner,
            'settlement_evidence' => [
                'persisted_settlement_ids' => array_column($linkedSettlements, 'id'),
                'linked_payment_ids' => array_column($linkedPayments, 'id'),
                'probable_entry_ids' => array_column($probableEntries, 'id'),
            ],
            'manual_review' => $manualPaid || count($probableEntries) > 0 || empty($plan['project_id']),
            'blocker' => $blocker,
        ];
    }
    return $result;
}

function classifier_classify_entries(array $entries, array $payments, array $expenses): array
{
    $duplicateEntryIds = [];
    foreach (array_merge($payments, $expenses) as $row) {
        foreach ($row['candidate_entry_ids'] ?? [] as $id) {
            $duplicateEntryIds[$id] = true;
        }
    }
    $result = [];
    foreach ($entries as $entry) {
        $invalidDirection = !in_array($entry['direction'] ?? null, ['Gelir', 'Gider'], true);
        $invalidStatus = !in_array($entry['status'] ?? null, ['Planlandı', 'Gerçekleşti', 'İptal'], true);
        $invalidGroup = !in_array($entry['group_tag'] ?? null, ['Resmi', 'Gayri Resmi'], true);
        $invalidCurrency = !in_array($entry['currency_tag'] ?? null, ['TRY', 'USD', 'EUR'], true);
        $missingOwner = empty($entry['customer_id']) && empty($entry['employee_id']) && empty($entry['expense_card_id']);
        $missingProject = empty($entry['project_id']);
        $blocker = $invalidDirection || $invalidStatus || $invalidGroup || $invalidCurrency || $missingOwner;
        $result[] = [
            'id' => $entry['id'],
            'classification' => $blocker ? 'blocker' : (($entry['status'] ?? null) === 'Planlandı' ? 'likely_forecast' : 'likely_posted'),
            'missing_event_type' => empty($entry['event_type']),
            'invalid_direction' => $invalidDirection,
            'invalid_status' => $invalidStatus,
            'invalid_group' => $invalidGroup,
            'invalid_currency' => $invalidCurrency,
            'missing_counterparty' => $missingOwner,
            'missing_project_scope' => empty($entry['allocation_scope']) || ($missingProject && empty($entry['allocation_note'])),
            'likely_duplicate_against_legacy' => isset($duplicateEntryIds[$entry['id']]),
            'manual_review' => empty($entry['event_type']) || $missingProject || isset($duplicateEntryIds[$entry['id']]),
            'blocker' => $blocker,
        ];
    }
    return $result;
}

function classifier_maturity_problem(array $plan, string $today): bool
{
    $method = $plan['payment_method'] ?? null;
    if ($method === 'Çek') {
        return empty($plan['cheque_maturity_date'])
            || (($plan['status'] ?? null) === 'Ödendi' && $plan['cheque_maturity_date'] > $today);
    }
    if ($method === 'Senet') {
        return empty($plan['promissory_maturity_date'])
            || (($plan['status'] ?? null) === 'Ödendi' && $plan['promissory_maturity_date'] > $today);
    }
    return false;
}

function classifier_count_flag(array $rows, string $flag): int
{
    return count(array_filter($rows, static fn(array $row): bool => !empty($row[$flag])));
}

function classifier_count_classes(array $rows): array
{
    $counts = [];
    foreach ($rows as $row) {
        $class = (string) ($row['classification'] ?? 'unknown');
        $counts[$class] = ($counts[$class] ?? 0) + 1;
    }
    ksort($counts);
    return $counts;
}

function classifier_amount_totals(array $data): array
{
    $totals = [];
    foreach (['payments' => 'TRY', 'expenses' => 'TRY'] as $source => $currency) {
        $totals[$source][$currency] = array_sum(array_map(static fn(array $row): float => (float) $row['amount'], $data[$source]));
    }
    foreach ($data['entries'] as $entry) {
        $currency = (string) ($entry['currency_tag'] ?? 'UNKNOWN');
        $type = ($entry['direction'] ?? null) === 'Gelir' ? 'ledger_income' : 'ledger_expense';
        $totals[$type][$currency] = ($totals[$type][$currency] ?? 0.0) + (float) $entry['amount'];
    }
    foreach ($data['plans'] as $plan) {
        $currency = (string) ($plan['currency'] ?? 'UNKNOWN');
        $type = ($plan['customer_id'] ?? null) ? 'receivable_plans' : 'payable_plans';
        $totals[$type][$currency] = ($totals[$type][$currency] ?? 0.0) + (float) $plan['amount'];
    }
    return $totals;
}

function classifier_money(mixed $value): string
{
    return number_format((float) $value, 2, '.', '');
}

function classifier_day_diff(string $left, string $right): int
{
    $leftTime = strtotime($left);
    $rightTime = strtotime($right);
    if ($leftTime === false || $rightTime === false) {
        return PHP_INT_MAX;
    }
    return (int) round(($leftTime - $rightTime) / 86400);
}

function classifier_write_report(string $path, string $json): void
{
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Could not create classifier output directory.');
    }
    if (file_put_contents($path, $json . PHP_EOL, LOCK_EX) === false) {
        throw new RuntimeException('Could not write classifier output.');
    }
}
