<?php
declare(strict_types=1);

require_once __DIR__ . '/../public_html/api/admin/backend-canonical-read-model.php';

$asOf = new DateTimeImmutable('2026-06-15');

$plans = [
    [
        'id' => 'plan-paid',
        'customer_id' => 'customer-1',
        'project_id' => 'project-1',
        'amount' => 1000,
        'paid_amount' => 0,
        'account_type' => 'resmi',
        'due_date' => '2026-06-01',
        'status' => 'Bekliyor',
    ],
    [
        'id' => 'plan-partial',
        'customer_id' => 'customer-1',
        'project_id' => 'project-1',
        'amount' => 800,
        'paid_amount' => 100,
        'account_type' => 'resmi',
        'due_date' => '2026-06-10',
        'status' => 'Kısmi Ödendi',
    ],
    [
        'id' => 'plan-upcoming',
        'customer_id' => 'customer-1',
        'project_id' => 'project-1',
        'amount' => 600,
        'paid_amount' => 0,
        'account_type' => 'gayri_resmi',
        'due_date' => '2026-06-20',
        'status' => 'Bekliyor',
    ],
    [
        'id' => 'plan-canceled',
        'customer_id' => 'customer-1',
        'project_id' => 'project-1',
        'amount' => 999,
        'paid_amount' => 0,
        'account_type' => 'resmi',
        'due_date' => '2026-06-01',
        'status' => 'İptal',
    ],
];

$payments = [
    ['customer_id' => 'customer-1', 'payment_plan_id' => 'plan-paid', 'amount' => 1000, 'account_type' => 'resmi'],
    ['customer_id' => 'customer-1', 'payment_plan_id' => 'plan-partial', 'amount' => 300, 'account_type' => 'resmi'],
    ['customer_id' => 'customer-1', 'payment_plan_id' => '', 'amount' => 200, 'account_type' => 'resmi'],
];

$states = canonical_read_plan_states($plans, $payments, $asOf);
$byId = [];
foreach ($states as $state) {
    $byId[$state['id']] = $state;
}

$assertions = [
    'paid linked plan has zero remaining' => canonical_read_money($byId['plan-paid']['remaining_amount'] ?? -1) === 0.0,
    'partial plan uses linked plus unlinked allocation' => canonical_read_money($byId['plan-partial']['paid_amount'] ?? 0) === 500.0,
    'partial plan has canonical partial status' => ($byId['plan-partial']['canonical_status'] ?? null) === 'partial',
    'partial overdue flag is true' => ($byId['plan-partial']['canonical_is_overdue'] ?? false) === true,
    'upcoming unofficial plan stays separate and unpaid' => canonical_read_money($byId['plan-upcoming']['remaining_amount'] ?? 0) === 600.0,
    'canceled plan is excluded' => !isset($byId['plan-canceled']),
];

$buckets = canonical_read_customer_plan_buckets($plans, $payments, $asOf);
$assertions['overdue bucket contains partial plan only'] = count($buckets['overdue']) === 1 && ($buckets['overdue'][0]['id'] ?? null) === 'plan-partial';
$assertions['upcoming bucket contains unofficial upcoming plan'] = count($buckets['upcoming']) === 1 && ($buckets['upcoming'][0]['id'] ?? null) === 'plan-upcoming';

$ledger = canonical_read_ledger_summary([
    ['amount' => 1000, 'currency_tag' => 'TRY', 'direction' => 'Gelir', 'status' => 'Gerçekleşti', 'entry_date' => '2026-06-01'],
    ['amount' => 250, 'currency_tag' => 'TRY', 'direction' => 'Gider', 'status' => 'Gerçekleşti', 'entry_date' => '2026-06-02'],
    ['amount' => 300, 'currency_tag' => 'TRY', 'direction' => 'Gelir', 'status' => 'Planlandı', 'entry_date' => '2026-07-01'],
    ['amount' => 999, 'currency_tag' => 'USD', 'direction' => 'Gelir', 'status' => 'Gerçekleşti', 'entry_date' => '2026-06-01'],
], $asOf);

$assertions['ledger realized income TRY'] = $ledger['realized_income_try'] === 1000.0;
$assertions['ledger realized expense TRY'] = $ledger['realized_expense_try'] === 250.0;
$assertions['ledger planned income TRY'] = $ledger['planned_income_try'] === 300.0;

$paymentsSummary = canonical_read_payment_summary([
    ['amount' => 100, 'payment_date' => '2026-06-01'],
    ['amount' => 50, 'payment_date' => '2026-05-31'],
], $asOf);
$expensesSummary = canonical_read_expense_summary([
    ['amount' => 70, 'expense_date' => '2026-06-03'],
    ['amount' => 30, 'expense_date' => '2026-05-29'],
], $asOf);

$assertions['payment total summary'] = $paymentsSummary['total'] === 150.0 && $paymentsSummary['month_total'] === 100.0;
$assertions['expense total summary'] = $expensesSummary['total'] === 100.0 && $expensesSummary['month_total'] === 70.0;

$failures = array_keys(array_filter($assertions, static fn(bool $passed): bool => !$passed));

if ($failures !== []) {
    fwrite(STDERR, "Backend canonical read-model parity failed:\n- " . implode("\n- ", $failures) . "\n");
    exit(1);
}

echo "Backend canonical read-model parity: PASS\n";
