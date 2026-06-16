<?php
declare(strict_types=1);

define('CANONICAL_SETTLEMENT_ENABLED', true);
require_once __DIR__ . '/../public_html/api/admin/canonical-transaction-service.php';

final class CanonicalMemoryStatement extends PDOStatement
{
    private array $rows = [];
    private int $affected = 0;
    public function __construct(private CanonicalMemoryPDO $db, private string $sql) {}
    public function execute(?array $params = null): bool { [$this->rows,$this->affected]=$this->db->run($this->sql,$params??[]); return true; }
    public function fetch(int $mode=PDO::FETCH_DEFAULT,int $cursorOrientation=PDO::FETCH_ORI_NEXT,int $cursorOffset=0): mixed { return array_shift($this->rows)??false; }
    public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args): array { $rows=$this->rows; $this->rows=[]; return $rows; }
    public function rowCount(): int { return $this->affected; }
}

final class CanonicalMemoryPDO extends PDO
{
    public array $plans=[];
    public array $entries=[];
    public array $settlements=[];
    public array $sql=[];
    public bool $failSettlementInsert=false;
    private bool $transaction=false;
    private array $snapshot=[];
    public function __construct() {}
    public function prepare(string $query,array $options=[]): PDOStatement|false { $this->sql[]=$query; return new CanonicalMemoryStatement($this,$query); }
    public function beginTransaction(): bool { $this->snapshot=[$this->plans,$this->entries,$this->settlements]; return $this->transaction=true; }
    public function commit(): bool { $this->snapshot=[]; $this->transaction=false; return true; }
    public function rollBack(): bool { [$this->plans,$this->entries,$this->settlements]=$this->snapshot; $this->transaction=false; return true; }
    public function inTransaction(): bool { return $this->transaction; }

    public function run(string $sql,array $params): array
    {
        if (str_contains($sql,'FROM ak_payment_plans WHERE id')) return [isset($this->plans[$params['id']])?[$this->plans[$params['id']]]:[],0];
        if (str_contains($sql,'FROM ak_financial_entries WHERE id')) return [isset($this->entries[$params['id']])?[$this->entries[$params['id']]]:[],0];
        if (str_contains($sql,'business_transaction_id = :id')) { foreach($this->entries as $row) if(($row['business_transaction_id']??null)===$params['id']) return [[$row],0]; return [[],0]; }
        if (str_contains($sql,'source_type = :type')) { foreach($this->entries as $row) if(($row['source_type']??null)===$params['type']&&($row['source_id']??null)===$params['id']) return [[$row],0]; return [[],0]; }
        if (str_starts_with($sql,'INSERT INTO ak_financial_entries')) { $this->entries[$params['id']]=$params+['created_at'=>'2026-06-15 00:00:00']; return [[],1]; }
        if (str_contains($sql,'payment_plan_id = :plan AND financial_entry_id')) { foreach($this->settlements as $row) if($row['payment_plan_id']===$params['plan']&&$row['financial_entry_id']===$params['entry']&&empty($row['reversed_at'])) return [[$row],0]; return [[],0]; }
        if (str_contains($sql,'FROM ak_payment_plan_settlements WHERE id')) return [isset($this->settlements[$params['id']])?[$this->settlements[$params['id']]]:[],0];
        if (str_contains($sql,'SELECT allocated_amount FROM ak_payment_plan_settlements')) { $column=str_contains($sql,'payment_plan_id')?'payment_plan_id':'financial_entry_id'; $rows=[]; foreach($this->settlements as $row) if($row[$column]===$params['id']&&empty($row['reversed_at'])) $rows[]=['allocated_amount'=>$row['allocated_amount']]; return [$rows,0]; }
        if (str_contains($sql,'WHERE financial_entry_id = :id AND reversed_at IS NULL FOR UPDATE')) { $rows=[]; foreach($this->settlements as $row) if($row['financial_entry_id']===$params['id']&&empty($row['reversed_at'])) $rows[]=$row; return [$rows,0]; }
        if (str_starts_with($sql,'INSERT INTO ak_payment_plan_settlements')) { if($this->failSettlementInsert) throw new RuntimeException('synthetic insert failure'); $this->settlements[$params['id']]=$params+['reversed_at'=>null]; return [[],1]; }
        if (str_starts_with($sql,'UPDATE ak_payment_plan_settlements')) { $this->settlements[$params['id']]['reversed_at']='2026-06-15 00:00:00'; return [[],1]; }
        if (str_starts_with($sql,'UPDATE ak_financial_entries SET status')) { $row=&$this->entries[$params['id']]; if(($row['status']??null)!=='posted'||!empty($row['reversal_entry_id'])) return [[],0]; $row['status']='reversed'; $row['reversal_entry_id']=$params['reversal_id']; return [[],1]; }
        throw new RuntimeException('Unhandled SQL: '.$sql);
    }
}

function foundationAssert(bool $condition,string $message): void { if(!$condition) throw new RuntimeException($message); }
function foundationThrows(callable $callable,string $contains): void { try{$callable();}catch(Throwable $e){foundationAssert(str_contains($e->getMessage(),$contains),$e->getMessage());return;}throw new RuntimeException('Expected exception: '.$contains); }
function foundationEntry(string $id='entry-1'): array { return ['id'=>$id,'business_transaction_id'=>'business-'.$id,'event_type'=>'customer_receipt','direction'=>'income','status'=>'posted','account_type'=>'resmi','allocation_scope'=>'project','counterparty_type'=>'customer','counterparty_id'=>'customer-1','customer_id'=>'customer-1','project_id'=>'project-1','currency'=>'TRY','transaction_date'=>'2026-06-15','amount'=>100,'base_amount'=>100,'title'=>'Synthetic']; }
function foundationPlan(): array { return ['id'=>'plan-1','business_transaction_id'=>'plan-business-1','direction'=>'income','account_type'=>'resmi','allocation_scope'=>'project','counterparty_type'=>'customer','counterparty_id'=>'customer-1','customer_id'=>'customer-1','project_id'=>'project-1','currency'=>'TRY','amount'=>100,'due_date'=>'2026-06-01','status'=>'Bekliyor']; }

$tests=[];
$tests['legacy source idempotency']=static function():void{$db=new CanonicalMemoryPDO();$a=createLegacyBackedEntry($db,'legacy_payment','legacy-1',foundationEntry());$b=createLegacyBackedEntry($db,'legacy_payment','legacy-1',foundationEntry());foundationAssert($a['id']===$b['id']&&count($db->entries)===1,'Idempotency failed');};
$tests['settlement locks and paid state']=static function():void{$db=new CanonicalMemoryPDO();$db->plans['plan-1']=foundationPlan();$db->entries['entry-1']=canonicalBuildEntryPayload(foundationEntry());$r=settlePlan($db,['id'=>'settlement-1','payment_plan_id'=>'plan-1','financial_entry_id'=>'entry-1','allocated_amount'=>100,'as_of'=>'2026-06-15']);foundationAssert($r['plan_state']['status']==='paid','Plan not paid');foundationAssert(count(array_filter($db->sql,fn($sql)=>str_contains($sql,'FOR UPDATE')))>=4,'Locks missing');};
$tests['official unofficial isolation']=static function():void{$db=new CanonicalMemoryPDO();$db->plans['plan-1']=foundationPlan();$entry=foundationEntry();$entry['account_type']='gayri_resmi';$db->entries['entry-1']=canonicalBuildEntryPayload($entry);foundationThrows(fn()=>settlePlan($db,['id'=>'s','payment_plan_id'=>'plan-1','financial_entry_id'=>'entry-1','allocated_amount'=>10]),'Resmi/Gayri Resmi');};
$tests['currency isolation']=static function():void{$db=new CanonicalMemoryPDO();$db->plans['plan-1']=foundationPlan();$entry=foundationEntry();$entry['currency']='USD';$entry['exchange_rate']=32;$db->entries['entry-1']=canonicalBuildEntryPayload($entry);foundationThrows(fn()=>settlePlan($db,['id'=>'s','payment_plan_id'=>'plan-1','financial_entry_id'=>'entry-1','allocated_amount'=>10]),'currency');};
$tests['concurrent over allocation loser']=static function():void{$db=new CanonicalMemoryPDO();$db->plans['plan-1']=foundationPlan();$db->entries['entry-1']=canonicalBuildEntryPayload(foundationEntry());$db->entries['entry-2']=canonicalBuildEntryPayload(foundationEntry('entry-2'));settlePlan($db,['id'=>'s1','payment_plan_id'=>'plan-1','financial_entry_id'=>'entry-1','allocated_amount'=>80]);foundationThrows(fn()=>settlePlan($db,['id'=>'s2','payment_plan_id'=>'plan-1','financial_entry_id'=>'entry-2','allocated_amount'=>30]),'remaining plan amount');foundationAssert(count($db->settlements)===1,'Losing writer changed state');};
$tests['rollback on write failure']=static function():void{$db=new CanonicalMemoryPDO();$db->plans['plan-1']=foundationPlan();$db->entries['entry-1']=canonicalBuildEntryPayload(foundationEntry());$db->failSettlementInsert=true;foundationThrows(fn()=>settlePlan($db,['id'=>'s1','payment_plan_id'=>'plan-1','financial_entry_id'=>'entry-1','allocated_amount'=>20]),'synthetic insert failure');foundationAssert(count($db->settlements)===0&&!$db->inTransaction(),'Rollback failed');};
$tests['reversal preserves history']=static function():void{$db=new CanonicalMemoryPDO();$db->plans['plan-1']=foundationPlan();$db->entries['entry-1']=canonicalBuildEntryPayload(foundationEntry());$db->settlements['s1']=['id'=>'s1','payment_plan_id'=>'plan-1','financial_entry_id'=>'entry-1','allocated_amount'=>25,'currency'=>'TRY','account_type'=>'resmi','reversed_at'=>null];$r=reverseCanonicalEntry($db,'entry-1',['id'=>'reversal-1','business_transaction_id'=>'business-reversal-1','transaction_date'=>'2026-06-15','reason'=>'Synthetic correction']);foundationAssert($r['original']['status']==='reversed'&&$r['reversal']['event_type']==='reversal','Reversal failed');foundationAssert(!empty($db->settlements['s1']['reversed_at']),'Settlement not reversed');};

$failed=0;foreach($tests as $name=>$test){try{$test();echo "PASS {$name}\n";}catch(Throwable $e){$failed++;echo "FAIL {$name}: {$e->getMessage()}\n";}}exit($failed===0?0:1);
