<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only.\n");
}

require_once __DIR__ . '/../public_html/api/admin/canonical-finance-service.php';

$tests = [];
$add = static function (string $name, callable $test) use (&$tests): void {
    $tests[] = [$name, $test];
};
$receipt = [
    'business_transaction_id' => 'tx-1',
    'event_type' => 'customer_receipt',
    'direction' => 'income',
    'status' => 'posted',
    'account_type' => 'resmi',
    'allocation_scope' => 'project',
    'counterparty_type' => 'customer',
    'counterparty_id' => 'customer-1',
    'customer_id' => 'customer-1',
    'project_id' => 'project-1',
    'currency' => 'TRY',
    'amount' => 1000,
    'base_amount' => 1000,
    'transaction_date' => '2026-06-14',
];

$add('valid customer receipt', static function () use ($receipt): void {
    parity_same([], canonical_validate_ledger_payload($receipt, new DateTimeImmutable('2026-06-14')));
});
$add('unsupported currency', static function () use ($receipt): void {
    parity_contains('currency is required and must be canonical.', canonical_validate_ledger_payload([...$receipt, 'currency' => 'GBP']));
});
$add('invalid account type', static function () use ($receipt): void {
    parity_contains('account_type is required and must be canonical.', canonical_validate_ledger_payload([...$receipt, 'account_type' => 'mixed']));
});
$add('invalid counterparty', static function () use ($receipt): void {
    parity_contains('The selected counterparty type requires counterparty_id.', canonical_validate_ledger_payload([...$receipt, 'counterparty_id' => null, 'customer_id' => null]));
});
$add('project required unless company overhead', static function () use ($receipt): void {
    parity_contains('Project scope requires project_id.', canonical_validate_ledger_payload([...$receipt, 'project_id' => null]));
    $overhead = [...$receipt, 'event_type' => 'general_expense', 'direction' => 'expense', 'counterparty_type' => 'other',
        'counterparty_id' => null, 'customer_id' => null, 'allocation_scope' => 'company_overhead',
        'project_id' => null, 'allocation_note' => 'Head office utility'];
    parity_same([], canonical_validate_ledger_payload($overhead));
});
$add('cheque/senet maturity policy', static function () use ($receipt): void {
    parity_contains('Cheque/senet is realized only when cleared or paid at maturity.', canonical_validate_cheque_senet_maturity_policy(
        [...$receipt, 'payment_method' => 'Çek', 'cheque_maturity_date' => '2026-06-20', 'instrument_status' => 'received'],
        new DateTimeImmutable('2026-06-14')
    ));
});
$add('settlement account mismatch', static function () use ($receipt): void {
    parity_throws(static fn() => canonical_assert_same_account_type(
        [...$receipt, 'account_type' => 'resmi'],
        [...$receipt, 'account_type' => 'gayri_resmi'],
        ['account_type' => 'resmi']
    ), 'Resmi/Gayri Resmi settlement must never cross.');
});
$add('settlement currency mismatch', static function () use ($receipt): void {
    parity_throws(static fn() => canonical_assert_same_currency(
        [...$receipt, 'currency' => 'TRY'],
        [...$receipt, 'currency' => 'EUR'],
        ['currency' => 'TRY']
    ), 'Plan, entry, and settlement currency must match.');
});
$add('over-allocation rejected', static function (): void {
    parity_throws(static fn() => canonical_assert_no_over_allocation(600, 1000, 500, 1000, 200), 'Settlement exceeds remaining plan amount.');
});
$add('partial status', static function (): void {
    parity_same(['status' => 'partial', 'remaining_amount' => 600.0, 'is_overdue' => false],
        canonical_derive_plan_status_from_settlements(1000, 400, '2026-06-20', new DateTimeImmutable('2026-06-14')));
});
$add('full paid status', static function (): void {
    parity_same('paid', canonical_derive_plan_status_from_settlements(1000, 1000, '2026-06-20', new DateTimeImmutable('2026-06-14'))['status']);
});
$add('past-due partial remains overdue', static function (): void {
    parity_same(['status' => 'partial', 'remaining_amount' => 600.0, 'is_overdue' => true],
        canonical_derive_plan_status_from_settlements(1000, 400, '2026-06-10', new DateTimeImmutable('2026-06-14')));
});
$add('posted entry immutability', static function () use ($receipt): void {
    parity_contains('Posted entry field amount is immutable.', canonical_validate_immutable_posted_entry($receipt, ['amount' => 900]));
});
$add('reversal requires parent and reason', static function (): void {
    parity_same([
        'Reversal or adjustment requires parent_entry_id.',
        'Reversal or adjustment requires a reason.',
    ], canonical_validate_reversal_adjustment_requirements(['event_type' => 'reversal']));
});
$add('official/unofficial never crosses', static function () use ($receipt): void {
    parity_throws(static fn() => canonical_assert_same_account_type(
        [...$receipt, 'account_type' => 'resmi'],
        [...$receipt, 'account_type' => 'gayri_resmi']
    ), 'Resmi/Gayri Resmi settlement must never cross.');
});

$failed = 0;
foreach ($tests as [$name, $test]) {
    try {
        $test();
        echo "[PASS] {$name}\n";
    } catch (Throwable $exception) {
        $failed++;
        echo "[FAIL] {$name}: {$exception->getMessage()}\n";
    }
}
echo sprintf("\n%d passed, %d failed\n", count($tests) - $failed, $failed);
exit($failed === 0 ? 0 : 1);

function parity_same(mixed $expected, mixed $actual): void
{
    if ($expected !== $actual) {
        throw new RuntimeException('Expected ' . json_encode($expected) . ', got ' . json_encode($actual));
    }
}

function parity_contains(string $expected, array $actual): void
{
    if (!in_array($expected, $actual, true)) {
        throw new RuntimeException("Missing expected error: {$expected}");
    }
}

function parity_throws(callable $callback, string $message): void
{
    try {
        $callback();
    } catch (Throwable $exception) {
        if ($exception->getMessage() === $message) {
            return;
        }
        throw new RuntimeException("Expected exception '{$message}', got '{$exception->getMessage()}'");
    }
    throw new RuntimeException("Expected exception: {$message}");
}
