<?php
declare(strict_types=1);

require_once __DIR__ . '/backend-canonical-read-model.php';

const CANONICAL_READ_REQUIRED_DASHBOARD_SUMMARY = [
    'total_payments',
    'total_expenses',
    'basic_net_balance',
    'planned_income',
    'month_income',
    'month_expenses',
    'month_net',
    'overdue_collections',
    'expected_payments',
    'overdue_plan_count',
    'upcoming_plan_count',
    'financial_entry_count',
];

const CANONICAL_READ_REQUIRED_REPORTS_AGGREGATES = [
    'total_projects',
    'total_customers',
    'total_payments',
    'total_expenses',
    'total_contact_requests',
];

const CANONICAL_READ_COMPARATOR_IGNORED_KEYS = [
    'canonical_is_overdue',
    'canonical_status',
];

function canonical_read_flags(): array
{
    return [
        'enabled' => canonical_read_flag('CANONICAL_READ_MODEL_ENABLED', false),
        'shadow_compare' => canonical_read_flag('CANONICAL_READ_MODEL_SHADOW_COMPARE', true),
        'fail_closed' => canonical_read_flag('CANONICAL_READ_MODEL_FAIL_CLOSED', true),
        'log_mismatches' => canonical_read_flag('CANONICAL_READ_MODEL_LOG_MISMATCHES', true),
    ];
}

function canonical_read_flag(string $name, bool $default): bool
{
    if (defined($name)) {
        return filter_var(constant($name), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $default;
    }

    $value = getenv($name);
    if ($value === false) {
        return $default;
    }

    return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $default;
}

function canonical_read_select(string $surface, array $legacy, array $canonical, array $requiredFields = []): array
{
    $flags = canonical_read_flags();
    $missing = canonical_read_missing_fields($canonical, $requiredFields);
    $mismatches = $flags['shadow_compare'] ? canonical_read_compare($legacy, $canonical) : [];

    if (($missing !== [] || $mismatches !== []) && $flags['log_mismatches']) {
        canonical_read_log_mismatch($surface, $missing, $mismatches);
    }

    if ($flags['enabled'] && (!$flags['fail_closed'] || $missing === [])) {
        return $canonical;
    }

    return $legacy;
}

function canonical_read_shadow_report(string $surface, array $legacy, array $canonical, array $requiredFields = []): array
{
    $missing = canonical_read_missing_fields($canonical, $requiredFields);
    $mismatches = canonical_read_compare($legacy, $canonical);

    return [
        'surface' => $surface,
        'status' => $missing === [] && $mismatches === [] ? 'PASS' : 'FAIL',
        'missing_required_fields' => $missing,
        'mismatch_count' => count($mismatches),
        'mismatches' => $mismatches,
    ];
}

function canonical_read_diagnostics(PDO $pdo): array
{
    $dashboardLegacy = canonical_read_legacy_dashboard_summary($pdo);
    $dashboardCanonical = canonical_read_dashboard_summary($pdo);
    $reportsLegacy = canonical_read_legacy_reports_aggregates($pdo);
    $reportsCanonical = canonical_read_reports_aggregates($pdo);

    $reports = [
        canonical_read_shadow_report('dashboard.summary', $dashboardLegacy['summary'], $dashboardCanonical['summary'], CANONICAL_READ_REQUIRED_DASHBOARD_SUMMARY),
        canonical_read_shadow_report('dashboard.overdue_plans', $dashboardLegacy['overdue_plans'], $dashboardCanonical['overdue_plans']),
        canonical_read_shadow_report('dashboard.upcoming_plans', $dashboardLegacy['upcoming_plans'], $dashboardCanonical['upcoming_plans']),
        canonical_read_shadow_report('dashboard.monthly_financials', canonical_read_legacy_monthly_financials($pdo), canonical_read_monthly_financials($pdo)),
        canonical_read_shadow_report('reports.aggregates', $reportsLegacy, $reportsCanonical, CANONICAL_READ_REQUIRED_REPORTS_AGGREGATES),
    ];

    return [
        'flags' => canonical_read_flags(),
        'status' => array_reduce($reports, static fn(string $status, array $report): string => $status === 'FAIL' || $report['status'] === 'FAIL' ? 'FAIL' : 'PASS', 'PASS'),
        'reports' => $reports,
    ];
}

function canonical_read_legacy_dashboard_summary(PDO $pdo): array
{
    $ledgerRows = canonical_read_all($pdo, "
        SELECT id, amount, currency_tag, direction, status, entry_date
        FROM ak_financial_entries
        WHERE status <> 'İptal'
    ");
    $paymentRows = canonical_read_all($pdo, 'SELECT id, amount, payment_date FROM ak_payments');
    $expenseRows = canonical_read_all($pdo, 'SELECT id, amount, expense_date FROM ak_expenses');
    $planRows = canonical_read_all($pdo, "
        SELECT id, title, amount, paid_amount, `date` AS due_date, status, customer_id, project_id, account_type
        FROM ak_payment_plans
        WHERE customer_id IS NOT NULL
        ORDER BY customer_id ASC, account_type ASC, `date` ASC
    ");
    $planPayments = canonical_read_all($pdo, "
        SELECT customer_id, payment_plan_id, amount, account_type
        FROM ak_payments
        WHERE customer_id IS NOT NULL
    ");

    $ledger = canonical_read_ledger_summary($ledgerRows);
    $payments = canonical_read_payment_summary($paymentRows);
    $expenses = canonical_read_expense_summary($expenseRows);
    $planBuckets = canonical_read_legacy_customer_plan_buckets($planRows, $planPayments);

    $hasLedgerEntries = $ledger['entry_count'] > 0;
    $totalPayments = ($hasLedgerEntries ? $ledger['realized_income_try'] : 0.0) + $payments['total'];
    $totalExpenses = ($hasLedgerEntries ? $ledger['realized_expense_try'] : 0.0) + $expenses['total'];
    $monthIncome = $ledger['month_income_try'] + $payments['month_total'];
    $monthExpenses = $ledger['month_expense_try'] + $expenses['month_total'];

    return [
        'summary' => [
            'total_payments' => $totalPayments,
            'total_expenses' => $totalExpenses,
            'basic_net_balance' => $totalPayments - $totalExpenses,
            'planned_income' => $ledger['planned_income_try'],
            'month_income' => $monthIncome,
            'month_expenses' => $monthExpenses,
            'month_net' => $monthIncome - $monthExpenses,
            'overdue_collections' => canonical_read_sum_remaining($planBuckets['overdue']),
            'expected_payments' => canonical_read_sum_remaining($planBuckets['upcoming']),
            'overdue_plan_count' => count($planBuckets['overdue']),
            'upcoming_plan_count' => count($planBuckets['upcoming']),
            'financial_entry_count' => $ledger['entry_count'],
        ],
        'overdue_plans' => $planBuckets['overdue'],
        'upcoming_plans' => $planBuckets['upcoming'],
    ];
}

function canonical_read_legacy_reports_aggregates(PDO $pdo): array
{
    return [
        'total_projects' => count(canonical_read_all($pdo, 'SELECT id FROM ak_projects')),
        'total_customers' => count(canonical_read_all($pdo, 'SELECT id FROM ak_customers')),
        'total_payments' => canonical_read_payment_summary(canonical_read_all($pdo, 'SELECT amount, payment_date FROM ak_payments'))['total'],
        'total_expenses' => canonical_read_expense_summary(canonical_read_all($pdo, 'SELECT amount, expense_date FROM ak_expenses'))['total'],
        'total_contact_requests' => count(canonical_read_all($pdo, 'SELECT id FROM ak_contact_requests')),
    ];
}

function canonical_read_legacy_monthly_financials(PDO $pdo, ?DateTimeImmutable $asOf = null): array
{
    return canonical_read_monthly_financials($pdo, $asOf);
}

function canonical_read_legacy_customer_plan_buckets(array $plans, array $payments, ?DateTimeImmutable $asOf = null): array
{
    $groups = [];
    foreach ($plans as $plan) {
        $key = (string) ($plan['customer_id'] ?? '') . '|' . canonical_read_account_type($plan['account_type'] ?? null);
        $groups[$key]['plans'][] = $plan;
    }
    foreach ($payments as $payment) {
        $key = (string) ($payment['customer_id'] ?? '') . '|' . canonical_read_account_type($payment['account_type'] ?? null);
        $groups[$key]['payments'][] = $payment;
    }

    $today = ($asOf ?? new DateTimeImmutable('today'))->format('Y-m-d');
    $in30 = ($asOf ?? new DateTimeImmutable('today'))->modify('+30 days')->format('Y-m-d');
    $overdue = [];
    $upcoming = [];

    foreach ($groups as $group) {
        $groupPlans = $group['plans'] ?? [];
        $activePlanIds = [];
        foreach ($groupPlans as $plan) {
            if (($plan['status'] ?? null) !== 'İptal') {
                $activePlanIds[(string) $plan['id']] = true;
            }
        }

        $linked = [];
        $unlinked = 0.0;
        foreach ($group['payments'] ?? [] as $payment) {
            $planId = trim((string) ($payment['payment_plan_id'] ?? ''));
            $amount = max(0.0, canonical_read_money($payment['amount'] ?? 0));
            if ($planId !== '' && isset($activePlanIds[$planId])) {
                $linked[$planId] = ($linked[$planId] ?? 0.0) + $amount;
            } elseif ($planId === '') {
                $unlinked += $amount;
            }
        }

        foreach ($groupPlans as $plan) {
            if (($plan['status'] ?? null) === 'İptal') {
                continue;
            }

            $amount = max(0.0, canonical_read_money($plan['amount'] ?? 0));
            $linkedPaid = min($amount, max(0.0, canonical_read_money($linked[$plan['id']] ?? 0)));
            $unlinkedPaid = ($plan['status'] ?? null) === 'Ödendi'
                ? 0.0
                : min(max(0.0, $amount - $linkedPaid), max(0.0, $unlinked));
            $unlinked -= $unlinkedPaid;
            $manualPaid = ($plan['status'] ?? null) === 'Ödendi'
                ? $amount
                : (($plan['status'] ?? null) === 'Kısmi Ödendi' ? max(0.0, canonical_read_money($plan['paid_amount'] ?? 0)) : 0.0);
            $paid = min($amount, max($manualPaid, $linkedPaid + $unlinkedPaid));
            $remaining = max(0.0, $amount - $paid);
            if ($remaining <= 0) {
                continue;
            }

            $plan['paid_amount'] = canonical_read_money($paid);
            $plan['remaining_amount'] = canonical_read_money($remaining);
            $dueDate = (string) ($plan['due_date'] ?? '');
            if ($dueDate < $today && $remaining > 0) {
                $overdue[] = $plan;
            } elseif ($dueDate >= $today && $dueDate <= $in30) {
                $upcoming[] = $plan;
            }
        }
    }

    canonical_read_sort_plan_list($overdue);
    canonical_read_sort_plan_list($upcoming);

    return ['overdue' => $overdue, 'upcoming' => $upcoming];
}

function canonical_read_legacy_notification_plan_states(array $plans, array $payments, ?DateTimeImmutable $asOf = null): array
{
    $buckets = canonical_read_legacy_customer_plan_buckets($plans, $payments, $asOf);
    return array_values(array_merge($buckets['overdue'], $buckets['upcoming']));
}

function canonical_read_missing_fields(array $data, array $requiredFields): array
{
    $missing = [];
    foreach ($requiredFields as $field) {
        if (!array_key_exists($field, $data)) {
            $missing[] = $field;
        }
    }

    return $missing;
}

function canonical_read_compare(array $legacy, array $canonical, string $path = ''): array
{
    $mismatches = [];
    if (canonical_read_is_id_list($legacy) && canonical_read_is_id_list($canonical)) {
        $legacy = canonical_read_index_list_by_id($legacy);
        $canonical = canonical_read_index_list_by_id($canonical);
    }

    $keys = array_values(array_unique(array_merge(array_keys($legacy), array_keys($canonical))));
    sort($keys);

    foreach ($keys as $key) {
        if (in_array((string) $key, CANONICAL_READ_COMPARATOR_IGNORED_KEYS, true)) {
            continue;
        }

        $nextPath = $path === '' ? (string) $key : $path . '.' . (string) $key;
        if (!array_key_exists($key, $legacy)) {
            $mismatches[] = ['path' => $nextPath, 'type' => 'missing_legacy_field'];
            continue;
        }
        if (!array_key_exists($key, $canonical)) {
            $mismatches[] = ['path' => $nextPath, 'type' => 'missing_canonical_field'];
            continue;
        }

        if (is_array($legacy[$key]) && is_array($canonical[$key])) {
            $mismatches = array_merge($mismatches, canonical_read_compare($legacy[$key], $canonical[$key], $nextPath));
            continue;
        }

        if (is_numeric($legacy[$key]) && is_numeric($canonical[$key])) {
            if (abs((float) $legacy[$key] - (float) $canonical[$key]) > 0.01) {
                $mismatches[] = ['path' => $nextPath, 'type' => 'amount_mismatch'];
            }
            continue;
        }

        if ((string) ($legacy[$key] ?? '') !== (string) ($canonical[$key] ?? '')) {
            $mismatches[] = ['path' => $nextPath, 'type' => 'value_mismatch'];
        }
    }

    return $mismatches;
}

function canonical_read_is_id_list(array $rows): bool
{
    if ($rows === []) {
        return false;
    }

    $index = 0;
    foreach ($rows as $key => $row) {
        if ($key !== $index || !is_array($row) || !array_key_exists('id', $row)) {
            return false;
        }
        $index++;
    }

    return true;
}

function canonical_read_index_list_by_id(array $rows): array
{
    $indexed = [];
    foreach ($rows as $row) {
        $id = (string) ($row['id'] ?? '');
        if ($id === '') {
            continue;
        }
        $indexed[$id] = $row;
    }
    ksort($indexed);

    return $indexed;
}

if (!function_exists('canonical_read_sort_plan_list')) {
    function canonical_read_sort_plan_list(array &$plans): void
    {
        usort($plans, static function (array $left, array $right): int {
            return [
                (string) ($left['due_date'] ?? ''),
                (string) ($left['customer_id'] ?? ''),
                canonical_read_account_type($left['account_type'] ?? null),
                (string) ($left['id'] ?? ''),
            ] <=> [
                (string) ($right['due_date'] ?? ''),
                (string) ($right['customer_id'] ?? ''),
                canonical_read_account_type($right['account_type'] ?? null),
                (string) ($right['id'] ?? ''),
            ];
        });
    }
}

function canonical_read_log_mismatch(string $surface, array $missingFields, array $mismatches): void
{
    error_log(json_encode([
        'event' => 'canonical_read_shadow_mismatch',
        'surface' => $surface,
        'missing_required_fields' => $missingFields,
        'mismatch_count' => count($mismatches),
        'mismatch_paths' => array_slice(array_map(static fn(array $mismatch): string => (string) ($mismatch['path'] ?? ''), $mismatches), 0, 25),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}
