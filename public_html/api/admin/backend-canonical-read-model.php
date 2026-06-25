<?php
declare(strict_types=1);

require_once __DIR__ . '/canonical-finance-service.php';

/**
 * Server-side canonical read-model facade.
 *
 * Phase 4J constraint: this file is read-only. It performs no writes, no DDL,
 * no schema migration, and no canonical activation.
 */

function canonical_read_dashboard_summary(PDO $pdo): array
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
    $planState = canonical_read_customer_plan_buckets($planRows, $planPayments);

    $hasLedgerEntries = $ledger['entry_count'] > 0;
    $totalPayments = ($hasLedgerEntries ? $ledger['realized_income_try'] : 0.0) + $payments['total'];
    $totalExpenses = ($hasLedgerEntries ? $ledger['realized_expense_try'] : 0.0) + $expenses['total'];

    return [
        'summary' => [
            'total_payments' => $totalPayments,
            'total_expenses' => $totalExpenses,
            'basic_net_balance' => $totalPayments - $totalExpenses,
            'planned_income' => $ledger['planned_income_try'],
            'month_income' => $ledger['month_income_try'] + $payments['month_total'],
            'month_expenses' => $ledger['month_expense_try'] + $expenses['month_total'],
            'month_net' => ($ledger['month_income_try'] + $payments['month_total']) - ($ledger['month_expense_try'] + $expenses['month_total']),
            'overdue_collections' => canonical_read_sum_remaining($planState['overdue']),
            'expected_payments' => canonical_read_sum_remaining($planState['upcoming']),
            'overdue_plan_count' => count($planState['overdue']),
            'upcoming_plan_count' => count($planState['upcoming']),
            'financial_entry_count' => $ledger['entry_count'],
        ],
        'overdue_plans' => $planState['overdue'],
        'upcoming_plans' => $planState['upcoming'],
    ];
}

function canonical_read_reports_aggregates(PDO $pdo): array
{
    $projects = canonical_read_all($pdo, 'SELECT id FROM ak_projects');
    $customers = canonical_read_all($pdo, 'SELECT id FROM ak_customers');
    $payments = canonical_read_all($pdo, 'SELECT amount, payment_date FROM ak_payments');
    $expenses = canonical_read_all($pdo, 'SELECT amount, expense_date FROM ak_expenses');
    $contactRequests = canonical_read_all($pdo, 'SELECT id FROM ak_contact_requests');

    return [
        'total_projects' => count($projects),
        'total_customers' => count($customers),
        'total_payments' => canonical_read_payment_summary($payments)['total'],
        'total_expenses' => canonical_read_expense_summary($expenses)['total'],
        'total_contact_requests' => count($contactRequests),
    ];
}

function canonical_read_monthly_financials(PDO $pdo, ?DateTimeImmutable $asOf = null): array
{
    $start = ($asOf ?? new DateTimeImmutable('today'))->modify('-5 months')->format('Y-m-01');
    $rows = array_merge(
        canonical_read_all($pdo, "
            SELECT entry_date AS finance_date, direction, amount
            FROM ak_financial_entries
            WHERE status = 'Gerçekleşti'
              AND currency_tag = 'TRY'
              AND entry_date >= :start
        ", ['start' => $start]),
        array_map(static fn(array $row): array => [
            'finance_date' => $row['payment_date'] ?? null,
            'direction' => 'Gelir',
            'amount' => $row['amount'] ?? 0,
        ], canonical_read_all($pdo, "
            SELECT payment_date, amount
            FROM ak_payments
            WHERE payment_date >= :start
        ", ['start' => $start])),
        array_map(static fn(array $row): array => [
            'finance_date' => $row['expense_date'] ?? null,
            'direction' => 'Gider',
            'amount' => $row['amount'] ?? 0,
        ], canonical_read_all($pdo, "
            SELECT expense_date, amount
            FROM ak_expenses
            WHERE expense_date >= :start
        ", ['start' => $start]))
    );

    $months = [];
    foreach ($rows as $row) {
        $date = (string) ($row['finance_date'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}/', $date)) {
            continue;
        }
        $month = substr($date, 0, 7);
        $months[$month] ??= ['month_key' => $month, 'income' => 0.0, 'expenses' => 0.0, 'net' => 0.0];
        $amount = canonical_read_money($row['amount'] ?? 0);
        if (($row['direction'] ?? null) === 'Gelir') {
            $months[$month]['income'] = canonical_read_money($months[$month]['income'] + $amount);
        } elseif (($row['direction'] ?? null) === 'Gider') {
            $months[$month]['expenses'] = canonical_read_money($months[$month]['expenses'] + $amount);
        }
        $months[$month]['net'] = canonical_read_money($months[$month]['income'] - $months[$month]['expenses']);
    }

    ksort($months);
    return array_values($months);
}

function canonical_read_customer_plan_buckets(array $plans, array $payments, ?DateTimeImmutable $asOf = null): array
{
    $today = ($asOf ?? new DateTimeImmutable('today'))->format('Y-m-d');
    $in30 = ($asOf ?? new DateTimeImmutable('today'))->modify('+30 days')->format('Y-m-d');
    $states = canonical_read_plan_states($plans, $payments, $asOf);

    $overdue = [];
    $upcoming = [];
    foreach ($states as $plan) {
        $remaining = canonical_read_money($plan['remaining_amount'] ?? 0);
        if ($remaining <= 0) {
            continue;
        }
        $dueDate = (string) ($plan['due_date'] ?? '');
        if ($dueDate < $today) {
            $overdue[] = $plan;
        } elseif ($dueDate >= $today && $dueDate <= $in30) {
            $upcoming[] = $plan;
        }
    }

    canonical_read_sort_plan_list($overdue);
    canonical_read_sort_plan_list($upcoming);

    return ['overdue' => $overdue, 'upcoming' => $upcoming, 'states' => $states];
}

function canonical_read_notification_plan_states(array $plans, array $payments, ?DateTimeImmutable $asOf = null): array
{
    return array_values(array_filter(
        canonical_read_plan_states($plans, $payments, $asOf),
        static fn(array $plan): bool => canonical_read_money($plan['remaining_amount'] ?? 0) > 0
    ));
}

function canonical_read_plan_states(array $plans, array $payments, ?DateTimeImmutable $asOf = null): array
{
    $groups = [];
    $standalone = [];
    foreach ($plans as $plan) {
        $customerId = trim((string) ($plan['customer_id'] ?? ''));
        if ($customerId === '') {
            $standalone[] = $plan;
            continue;
        }
        $key = $customerId . '|' . canonical_read_account_type($plan['account_type'] ?? null);
        $groups[$key]['plans'][] = $plan;
    }
    foreach ($payments as $payment) {
        $key = (string) ($payment['customer_id'] ?? '') . '|' . canonical_read_account_type($payment['account_type'] ?? null);
        $groups[$key]['payments'][] = $payment;
    }

    $result = [];
    foreach ($groups as $group) {
        $groupPlans = $group['plans'] ?? [];
        $activePlanIds = [];
        foreach ($groupPlans as $plan) {
            if (!canonical_read_is_canceled_plan($plan)) {
                $activePlanIds[(string) $plan['id']] = true;
            }
        }

        $linked = [];
        $unlinked = 0.0;
        foreach ($group['payments'] ?? [] as $payment) {
            $planId = trim((string) ($payment['payment_plan_id'] ?? ''));
            $amount = canonical_read_money($payment['amount'] ?? 0);
            if ($planId !== '' && isset($activePlanIds[$planId])) {
                $linked[$planId] = canonical_read_money(($linked[$planId] ?? 0.0) + $amount);
            } elseif ($planId === '') {
                $unlinked = canonical_read_money($unlinked + $amount);
            }
        }

        foreach ($groupPlans as $plan) {
            if (canonical_read_is_canceled_plan($plan)) {
                continue;
            }

            $amount = canonical_read_money($plan['amount'] ?? 0);
            $linkedPaid = min($amount, canonical_read_money($linked[$plan['id']] ?? 0));
            $unlinkedPaid = ($plan['status'] ?? null) === 'Ödendi'
                ? 0.0
                : min(max(0.0, $amount - $linkedPaid), max(0.0, $unlinked));
            $unlinked = canonical_read_money($unlinked - $unlinkedPaid);
            $manualPaid = canonical_read_manual_paid($plan, $amount);
            $paid = min($amount, max($manualPaid, canonical_read_money($linkedPaid + $unlinkedPaid)));
            $result[] = canonical_read_apply_plan_state($plan, $paid, $asOf);
        }
    }

    foreach ($standalone as $plan) {
        if (canonical_read_is_canceled_plan($plan)) {
            continue;
        }
        $amount = canonical_read_money($plan['amount'] ?? 0);
        $result[] = canonical_read_apply_plan_state($plan, canonical_read_manual_paid($plan, $amount), $asOf);
    }

    return $result;
}

function canonical_read_apply_plan_state(array $plan, float $paid, ?DateTimeImmutable $asOf = null): array
{
    $amount = canonical_read_money($plan['amount'] ?? 0);
    $state = canonical_derive_plan_status_from_settlements(
        $amount,
        min($amount, max(0.0, $paid)),
        (string) ($plan['due_date'] ?? ''),
        $asOf,
        false
    );
    $plan['paid_amount'] = canonical_read_money(min($amount, max(0.0, $paid)));
    $plan['remaining_amount'] = canonical_read_money($state['remaining_amount'] ?? 0);
    $plan['canonical_status'] = (string) ($state['status'] ?? '');
    $plan['canonical_is_overdue'] = (bool) ($state['is_overdue'] ?? false);

    return $plan;
}

function canonical_read_legacy_status_from_paid(float $amount, string $dueDate, float $paid, ?DateTimeImmutable $asOf = null): string
{
    $state = canonical_derive_plan_status_from_settlements($amount, $paid, $dueDate, $asOf);
    return match ($state['status']) {
        'paid' => 'Ödendi',
        'partial' => 'Kısmi Ödendi',
        'overdue' => 'Vadesi Geçti',
        default => 'Bekliyor',
    };
}

function canonical_read_payment_summary(array $rows, ?DateTimeImmutable $asOf = null): array
{
    $monthStart = ($asOf ?? new DateTimeImmutable('today'))->format('Y-m-01');
    $total = 0.0;
    $monthTotal = 0.0;
    foreach ($rows as $row) {
        $amount = canonical_read_money($row['amount'] ?? 0);
        $total = canonical_read_money($total + $amount);
        if ((string) ($row['payment_date'] ?? '') >= $monthStart) {
            $monthTotal = canonical_read_money($monthTotal + $amount);
        }
    }

    return ['total' => $total, 'month_total' => $monthTotal];
}

function canonical_read_expense_summary(array $rows, ?DateTimeImmutable $asOf = null): array
{
    $monthStart = ($asOf ?? new DateTimeImmutable('today'))->format('Y-m-01');
    $total = 0.0;
    $monthTotal = 0.0;
    foreach ($rows as $row) {
        $amount = canonical_read_money($row['amount'] ?? 0);
        $total = canonical_read_money($total + $amount);
        if ((string) ($row['expense_date'] ?? '') >= $monthStart) {
            $monthTotal = canonical_read_money($monthTotal + $amount);
        }
    }

    return ['total' => $total, 'month_total' => $monthTotal];
}

function canonical_read_ledger_summary(array $rows, ?DateTimeImmutable $asOf = null): array
{
    $monthStart = ($asOf ?? new DateTimeImmutable('today'))->format('Y-m-01');
    $summary = [
        'entry_count' => 0,
        'realized_income_try' => 0.0,
        'realized_expense_try' => 0.0,
        'planned_income_try' => 0.0,
        'month_income_try' => 0.0,
        'month_expense_try' => 0.0,
    ];

    foreach ($rows as $row) {
        $summary['entry_count']++;
        if (($row['currency_tag'] ?? null) !== 'TRY') {
            continue;
        }
        $amount = canonical_read_money($row['amount'] ?? 0);
        $status = (string) ($row['status'] ?? '');
        $direction = (string) ($row['direction'] ?? '');
        $date = (string) ($row['entry_date'] ?? '');

        if ($status === 'Gerçekleşti' && $direction === 'Gelir') {
            $summary['realized_income_try'] = canonical_read_money($summary['realized_income_try'] + $amount);
            if ($date >= $monthStart) {
                $summary['month_income_try'] = canonical_read_money($summary['month_income_try'] + $amount);
            }
        }
        if ($status === 'Gerçekleşti' && $direction === 'Gider') {
            $summary['realized_expense_try'] = canonical_read_money($summary['realized_expense_try'] + $amount);
            if ($date >= $monthStart) {
                $summary['month_expense_try'] = canonical_read_money($summary['month_expense_try'] + $amount);
            }
        }
        if ($status === 'Planlandı' && $direction === 'Gelir') {
            $summary['planned_income_try'] = canonical_read_money($summary['planned_income_try'] + $amount);
        }
    }

    return $summary;
}

function canonical_read_sum_remaining(array $plans): float
{
    return array_reduce($plans, static function (float $sum, array $plan): float {
        return canonical_read_money($sum + canonical_read_money($plan['remaining_amount'] ?? 0));
    }, 0.0);
}

function canonical_read_all(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function canonical_read_money(mixed $value): float
{
    return round((float) ($value ?? 0), 2);
}

function canonical_read_account_type(mixed $value): string
{
    return $value === 'gayri_resmi' ? 'gayri_resmi' : 'resmi';
}

function canonical_read_is_canceled_plan(array $plan): bool
{
    return ($plan['status'] ?? null) === 'İptal' || !empty($plan['canceled_at']) || !empty($plan['archived_at']);
}

function canonical_read_manual_paid(array $plan, float $amount): float
{
    return match ($plan['status'] ?? null) {
        'Ödendi' => $amount,
        'Kısmi Ödendi' => min($amount, canonical_read_money($plan['paid_amount'] ?? 0)),
        default => 0.0,
    };
}

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
