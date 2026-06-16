<?php
declare(strict_types=1);

define('CANONICAL_READ_MODEL_ENABLED', false);
define('CANONICAL_READ_MODEL_SHADOW_COMPARE', true);
define('CANONICAL_READ_MODEL_FAIL_CLOSED', true);
define('CANONICAL_READ_MODEL_LOG_MISMATCHES', false);

require_once __DIR__ . '/../public_html/api/admin/canonical-read-flags.php';

$legacy = ['total_payments' => 100.0, 'total_expenses' => 40.0, 'basic_net_balance' => 60.0];
$canonical = ['total_payments' => 100.0, 'total_expenses' => 40.0, 'basic_net_balance' => 60.0];
$mismatchCanonical = ['total_payments' => 99.0, 'total_expenses' => 40.0, 'basic_net_balance' => 59.0];
$missingCanonical = ['total_payments' => 100.0, 'total_expenses' => 40.0];
$legacyRows = [
    ['id' => 'b', 'amount' => 20],
    ['id' => 'a', 'amount' => 10],
];
$canonicalRows = [
    ['id' => 'a', 'amount' => 10],
    ['id' => 'b', 'amount' => 20],
];
$legacyPlanRows = [
    ['id' => 'plan-1', 'remaining_amount' => 100],
];
$canonicalPlanRows = [
    ['id' => 'plan-1', 'remaining_amount' => 100, 'canonical_status' => 'overdue', 'canonical_is_overdue' => true],
];
$partialOverdueBuckets = canonical_read_legacy_customer_plan_buckets([
    [
        'id' => 'partial-overdue',
        'customer_id' => 'customer-1',
        'project_id' => 'project-1',
        'amount' => 1000,
        'paid_amount' => 250,
        'due_date' => '2026-06-01',
        'status' => 'Kısmi Ödendi',
        'account_type' => 'resmi',
    ],
], [], new DateTimeImmutable('2026-06-16'));

$assertions = [
    'defaults keep legacy output selected' => canonical_read_select('fixture.same', $legacy, $canonical, ['total_payments']) === $legacy,
    'matching report passes' => canonical_read_shadow_report('fixture.same', $legacy, $canonical, ['total_payments'])['status'] === 'PASS',
    'amount mismatch is detected' => canonical_read_shadow_report('fixture.mismatch', $legacy, $mismatchCanonical, ['total_payments'])['status'] === 'FAIL',
    'missing required field is detected' => canonical_read_shadow_report('fixture.missing', $legacy, $missingCanonical, ['basic_net_balance'])['missing_required_fields'] === ['basic_net_balance'],
    'id-keyed list comparison ignores array order' => canonical_read_shadow_report('fixture.id-list', $legacyRows, $canonicalRows)['status'] === 'PASS',
    'canonical-only metadata fields do not count as mismatches' => canonical_read_shadow_report('fixture.metadata', $legacyPlanRows, $canonicalPlanRows)['status'] === 'PASS',
    'partial overdue plan remains in overdue bucket by remaining balance' => count($partialOverdueBuckets['overdue']) === 1
        && ($partialOverdueBuckets['overdue'][0]['id'] ?? null) === 'partial-overdue'
        && canonical_read_money($partialOverdueBuckets['overdue'][0]['remaining_amount'] ?? 0) === 750.0,
];

$failures = array_keys(array_filter($assertions, static fn(bool $passed): bool => !$passed));
if ($failures !== []) {
    fwrite(STDERR, "Canonical read flags test failed:\n- " . implode("\n- ", $failures) . "\n");
    exit(1);
}

echo "Canonical read flags: PASS\n";
