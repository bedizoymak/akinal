<?php
declare(strict_types=1);

define('CANONICAL_SETTLEMENT_ENABLED', true);
require_once __DIR__ . '/../public_html/api/admin/canonical-shadow-write-harness.php';

final class ShadowMemoryStatement extends PDOStatement
{
    private array $rows = [];
    private int $affected = 0;
    public function __construct(private ShadowMemoryPDO $db, private string $sql) {}
    public function execute(?array $params = null): bool { [$this->rows, $this->affected] = $this->db->run($this->sql, $params ?? []); return true; }
    public function fetch(int $mode = PDO::FETCH_DEFAULT, int $cursorOrientation = PDO::FETCH_ORI_NEXT, int $cursorOffset = 0): mixed { return array_shift($this->rows) ?? false; }
    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array { $rows = $this->rows; $this->rows = []; return $rows; }
    public function rowCount(): int { return $this->affected; }
}

final class ShadowMemoryPDO extends PDO
{
    public array $plans = [];
    public array $entries = [];
    public array $settlements = [];
    private bool $transaction = false;
    private array $snapshot = [];
    public function __construct() {}
    public function prepare(string $query, array $options = []): PDOStatement|false { return new ShadowMemoryStatement($this, $query); }
    public function beginTransaction(): bool { $this->snapshot = [$this->plans, $this->entries, $this->settlements]; return $this->transaction = true; }
    public function commit(): bool { $this->snapshot = []; $this->transaction = false; return true; }
    public function rollBack(): bool { [$this->plans, $this->entries, $this->settlements] = $this->snapshot; $this->transaction = false; return true; }
    public function inTransaction(): bool { return $this->transaction; }

    public function run(string $sql, array $params): array
    {
        if (str_contains($sql, 'FROM ak_payment_plans WHERE id')) return [isset($this->plans[$params['id']]) ? [$this->plans[$params['id']]] : [], 0];
        if (str_contains($sql, 'FROM ak_financial_entries WHERE id')) return [isset($this->entries[$params['id']]) ? [$this->entries[$params['id']]] : [], 0];
        if (str_contains($sql, 'business_transaction_id = :id')) { foreach ($this->entries as $row) if (($row['business_transaction_id'] ?? null) === $params['id']) return [[$row], 0]; return [[], 0]; }
        if (str_contains($sql, 'source_type = :type')) { foreach ($this->entries as $row) if (($row['source_type'] ?? null) === $params['type'] && ($row['source_id'] ?? null) === $params['id']) return [[$row], 0]; return [[], 0]; }
        if (str_starts_with($sql, 'INSERT INTO ak_financial_entries')) { $this->entries[$params['id']] = $params + ['currency' => $params['currency_tag'] ?? null, 'created_at' => '2026-06-15 00:00:00']; return [[], 1]; }
        if (str_contains($sql, 'payment_plan_id = :plan AND financial_entry_id')) { foreach ($this->settlements as $row) if ($row['payment_plan_id'] === $params['plan'] && $row['financial_entry_id'] === $params['entry'] && empty($row['reversed_at'])) return [[$row], 0]; return [[], 0]; }
        if (str_contains($sql, 'FROM ak_payment_plan_settlements WHERE id')) return [isset($this->settlements[$params['id']]) ? [$this->settlements[$params['id']]] : [], 0];
        if (str_contains($sql, 'SELECT allocated_amount FROM ak_payment_plan_settlements')) { $column = str_contains($sql, 'payment_plan_id') ? 'payment_plan_id' : 'financial_entry_id'; $rows = []; foreach ($this->settlements as $row) if ($row[$column] === $params['id'] && empty($row['reversed_at'])) $rows[] = ['allocated_amount' => $row['allocated_amount']]; return [$rows, 0]; }
        if (str_contains($sql, 'WHERE financial_entry_id = :id AND reversed_at IS NULL FOR UPDATE')) { $rows = []; foreach ($this->settlements as $row) if ($row['financial_entry_id'] === $params['id'] && empty($row['reversed_at'])) $rows[] = $row; return [$rows, 0]; }
        if (str_starts_with($sql, 'INSERT INTO ak_payment_plan_settlements')) { $this->settlements[$params['id']] = $params + ['reversed_at' => null]; return [[], 1]; }
        if (str_starts_with($sql, 'UPDATE ak_payment_plan_settlements')) { $this->settlements[$params['id']]['reversed_at'] = '2026-06-15 00:00:00'; return [[], 1]; }
        if (str_starts_with($sql, 'UPDATE ak_financial_entries SET status')) { $row =& $this->entries[$params['id']]; if (($row['status'] ?? null) !== 'posted' || !empty($row['reversal_entry_id'])) return [[], 0]; $row['status'] = 'reversed'; $row['reversal_entry_id'] = $params['reversal_id']; return [[], 1]; }
        throw new RuntimeException('Unhandled SQL: ' . $sql);
    }
}

function shadowPlan(string $id, string $ownerType, string $ownerId, float $amount, string $accountType = 'resmi'): array
{
    return [
        'id' => $id, 'business_transaction_id' => 'bt-' . $id, 'direction' => $ownerType === 'customer' ? 'income' : 'expense',
        'account_type' => $accountType, 'allocation_scope' => 'project', 'counterparty_type' => $ownerType,
        'counterparty_id' => $ownerId, 'customer_id' => $ownerType === 'customer' ? $ownerId : null,
        'employee_id' => $ownerType === 'employee' ? $ownerId : null, 'expense_card_id' => $ownerType === 'supplier' ? $ownerId : null,
        'project_id' => 'project-1', 'currency' => 'TRY', 'amount' => $amount, 'due_date' => '2026-06-01', 'status' => 'Bekliyor',
    ];
}

function shadowEntryCommand(string $id, string $eventType, string $ownerType, string $ownerId, float $amount, string $accountType = 'resmi'): array
{
    return [
        'id' => $id, 'business_transaction_id' => 'bt-' . $id, 'event_type' => $eventType,
        'direction' => in_array($eventType, ['customer_receipt', 'expense_refund'], true) ? 'income' : 'expense',
        'status' => 'posted', 'account_type' => $accountType, 'allocation_scope' => 'project',
        'counterparty_type' => $ownerType, 'counterparty_id' => $ownerId, 'customer_id' => $ownerType === 'customer' ? $ownerId : null,
        'employee_id' => $ownerType === 'employee' ? $ownerId : null, 'expense_card_id' => $ownerType === 'supplier' ? $ownerId : null,
        'project_id' => 'project-1', 'currency' => 'TRY', 'transaction_date' => '2026-06-15',
        'amount' => $amount, 'base_amount' => $amount, 'title' => 'Shadow synthetic',
    ];
}

function shadowAssertPass(array $comparison, string $name): void
{
    if (($comparison['status'] ?? null) !== 'PASS') {
        throw new RuntimeException($name . ' failed: ' . implode(', ', $comparison['mismatches'] ?? []));
    }
}

function runShadowCase(string $name, callable $case): array
{
    try {
        $comparisons = $case();
        foreach ($comparisons as $comparison) {
            shadowAssertPass($comparison, $name);
        }
        echo "PASS {$name}\n";
        return ['name' => $name, 'status' => 'PASS', 'report' => shadowBuildParityReport($comparisons)];
    } catch (Throwable $e) {
        echo "FAIL {$name}: {$e->getMessage()}\n";
        return ['name' => $name, 'status' => 'FAIL', 'error' => $e->getMessage()];
    }
}

$cases = [];
$cases['customer payment'] = static function (): array {
    $db = new ShadowMemoryPDO(); $db->plans['plan-1'] = shadowPlan('plan-1', 'customer', 'customer-1', 100);
    $entry = shadowCreateCanonicalEntry($db, ['id' => 'pay-1', 'source_type' => 'legacy_payment', 'amount' => 100, 'customer_id' => 'customer-1', 'project_id' => 'project-1', 'status' => 'posted'], shadowEntryCommand('entry-1', 'customer_receipt', 'customer', 'customer-1', 100));
    $settlement = shadowSettlePlan($db, ['amount' => 0, 'customer_id' => 'customer-1', 'project_id' => 'project-1', 'status' => 'paid'], ['id' => 'settle-1', 'payment_plan_id' => 'plan-1', 'financial_entry_id' => 'entry-1', 'allocated_amount' => 100, 'as_of' => '2026-06-15']);
    return [$entry, $settlement];
};
$cases['partial customer payment'] = static function (): array {
    $db = new ShadowMemoryPDO(); $db->plans['plan-1'] = shadowPlan('plan-1', 'customer', 'customer-1', 100);
    shadowCreateCanonicalEntry($db, ['id' => 'pay-1', 'source_type' => 'legacy_payment', 'amount' => 40, 'customer_id' => 'customer-1', 'project_id' => 'project-1', 'status' => 'posted'], shadowEntryCommand('entry-1', 'customer_receipt', 'customer', 'customer-1', 40));
    return [shadowSettlePlan($db, ['amount' => 60, 'customer_id' => 'customer-1', 'project_id' => 'project-1', 'status' => 'partial'], ['id' => 'settle-1', 'payment_plan_id' => 'plan-1', 'financial_entry_id' => 'entry-1', 'allocated_amount' => 40, 'as_of' => '2026-06-15'])];
};
$cases['personnel expense'] = static function (): array {
    $db = new ShadowMemoryPDO(); $db->plans['plan-1'] = shadowPlan('plan-1', 'employee', 'employee-1', 75);
    $entry = shadowCreateCanonicalEntry($db, ['id' => 'per-1', 'source_type' => 'legacy_personnel', 'amount' => 75, 'employee_id' => 'employee-1', 'project_id' => 'project-1', 'status' => 'posted'], shadowEntryCommand('entry-1', 'personnel_payment', 'employee', 'employee-1', 75));
    $settlement = shadowSettlePlan($db, ['amount' => 0, 'employee_id' => 'employee-1', 'project_id' => 'project-1', 'status' => 'paid'], ['id' => 'settle-1', 'payment_plan_id' => 'plan-1', 'financial_entry_id' => 'entry-1', 'allocated_amount' => 75, 'as_of' => '2026-06-15']);
    return [$entry, $settlement];
};
$cases['supplier material expense'] = static function (): array {
    $db = new ShadowMemoryPDO(); $db->plans['plan-1'] = shadowPlan('plan-1', 'supplier', 'supplier-1', 210);
    $entry = shadowCreateCanonicalEntry($db, ['id' => 'sup-1', 'source_type' => 'legacy_expense', 'amount' => 210, 'expense_card_id' => 'supplier-1', 'project_id' => 'project-1', 'status' => 'posted'], shadowEntryCommand('entry-1', 'supplier_payment', 'supplier', 'supplier-1', 210));
    $settlement = shadowSettlePlan($db, ['amount' => 0, 'expense_card_id' => 'supplier-1', 'project_id' => 'project-1', 'status' => 'paid'], ['id' => 'settle-1', 'payment_plan_id' => 'plan-1', 'financial_entry_id' => 'entry-1', 'allocated_amount' => 210, 'as_of' => '2026-06-15']);
    return [$entry, $settlement];
};
$cases['official payment'] = static function (): array { $db = new ShadowMemoryPDO(); return [shadowCreateCanonicalEntry($db, ['id' => 'off-1', 'source_type' => 'legacy_payment', 'amount' => 30, 'customer_id' => 'customer-1', 'project_id' => 'project-1', 'account_type' => 'resmi', 'status' => 'posted'], shadowEntryCommand('entry-1', 'customer_receipt', 'customer', 'customer-1', 30, 'resmi'))]; };
$cases['unofficial payment'] = static function (): array { $db = new ShadowMemoryPDO(); return [shadowCreateCanonicalEntry($db, ['id' => 'unoff-1', 'source_type' => 'legacy_payment', 'amount' => 30, 'customer_id' => 'customer-1', 'project_id' => 'project-1', 'account_type' => 'gayri_resmi', 'status' => 'posted'], shadowEntryCommand('entry-1', 'customer_receipt', 'customer', 'customer-1', 30, 'gayri_resmi'))]; };
$cases['project profitability impact'] = static function (): array {
    $db = new ShadowMemoryPDO();
    $income = shadowCreateCanonicalEntry($db, ['id' => 'income-1', 'source_type' => 'legacy_payment', 'amount' => 500, 'customer_id' => 'customer-1', 'project_id' => 'project-1', 'status' => 'posted'], shadowEntryCommand('income-entry', 'customer_receipt', 'customer', 'customer-1', 500));
    $expense = shadowCreateCanonicalEntry($db, ['id' => 'expense-1', 'source_type' => 'legacy_expense', 'amount' => 125, 'expense_card_id' => 'supplier-1', 'project_id' => 'project-1', 'status' => 'posted'], shadowEntryCommand('expense-entry', 'supplier_payment', 'supplier', 'supplier-1', 125));
    $legacyNet = 375.0; $canonicalNet = shadowMoney($db->entries['income-entry']['amount']) - shadowMoney($db->entries['expense-entry']['amount']);
    return [$income, $expense, shadowCompareSnapshots(['amount' => $legacyNet, 'currency' => 'TRY', 'account_type' => 'resmi', 'owner_type' => null, 'owner_id' => null, 'project_id' => 'project-1', 'status' => 'posted'], ['amount' => $canonicalNet, 'currency' => 'TRY', 'account_type' => 'resmi', 'owner_type' => null, 'owner_id' => null, 'project_id' => 'project-1', 'status' => 'posted'])];
};
$cases['reversal scenario'] = static function (): array {
    $db = new ShadowMemoryPDO(); $db->plans['plan-1'] = shadowPlan('plan-1', 'customer', 'customer-1', 100);
    shadowCreateCanonicalEntry($db, ['id' => 'pay-1', 'source_type' => 'legacy_payment', 'amount' => 100, 'customer_id' => 'customer-1', 'project_id' => 'project-1', 'status' => 'posted'], shadowEntryCommand('entry-1', 'customer_receipt', 'customer', 'customer-1', 100));
    settlePlan($db, ['id' => 'settle-1', 'payment_plan_id' => 'plan-1', 'financial_entry_id' => 'entry-1', 'allocated_amount' => 100, 'as_of' => '2026-06-15']);
    $reversal = reverseCanonicalEntry($db, 'entry-1', ['id' => 'reversal-1', 'business_transaction_id' => 'bt-reversal-1', 'transaction_date' => '2026-06-15', 'reason' => 'Shadow reversal']);
    return [shadowCompareSnapshots(shadowLegacySnapshot(['amount' => 100, 'currency' => 'TRY', 'account_type' => 'resmi', 'customer_id' => 'customer-1', 'project_id' => 'project-1', 'status' => 'reversed']), shadowCanonicalEntrySnapshot($reversal['original']))];
};

$results = array_map(fn(string $name, callable $case): array => runShadowCase($name, $case), array_keys($cases), $cases);
$failed = count(array_filter($results, static fn(array $row): bool => $row['status'] !== 'PASS'));

$riskComparison = shadowCompareSnapshots(
    shadowLegacySnapshot(['amount' => 100, 'currency' => 'TRY', 'account_type' => 'resmi', 'customer_id' => 'customer-1', 'project_id' => 'project-1', 'status' => 'posted', 'legacy_already_counted' => true]),
    ['amount' => 100, 'currency' => 'TRY', 'account_type' => 'resmi', 'owner_type' => 'customer', 'owner_id' => 'customer-1', 'project_id' => 'project-1', 'status' => 'posted'],
    true
);
if (!in_array(SHADOW_MISMATCH_DUPLICATE, $riskComparison['mismatches'], true)) {
    echo "FAIL duplicate risk classifier\n";
    $failed++;
} else {
    echo "PASS duplicate risk classifier\n";
}

echo json_encode(['status' => $failed === 0 ? 'PASS' : 'FAIL', 'cases' => $results, 'duplicate_risk_probe' => $riskComparison], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
exit($failed === 0 ? 0 : 1);
