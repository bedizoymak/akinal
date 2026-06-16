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

$assertions = [
    'defaults keep legacy output selected' => canonical_read_select('fixture.same', $legacy, $canonical, ['total_payments']) === $legacy,
    'matching report passes' => canonical_read_shadow_report('fixture.same', $legacy, $canonical, ['total_payments'])['status'] === 'PASS',
    'amount mismatch is detected' => canonical_read_shadow_report('fixture.mismatch', $legacy, $mismatchCanonical, ['total_payments'])['status'] === 'FAIL',
    'missing required field is detected' => canonical_read_shadow_report('fixture.missing', $legacy, $missingCanonical, ['basic_net_balance'])['missing_required_fields'] === ['basic_net_balance'],
];

$failures = array_keys(array_filter($assertions, static fn(bool $passed): bool => !$passed));
if ($failures !== []) {
    fwrite(STDERR, "Canonical read flags test failed:\n- " . implode("\n- ", $failures) . "\n");
    exit(1);
}

echo "Canonical read flags: PASS\n";
