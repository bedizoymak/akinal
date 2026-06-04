# Root Cause

- Müşteri Detayı içinde gösterilen `Giderler` paneli müşteri tahsilat/alacak akışının parçası değildi.
- Panel, müşteri bakiyesi ve ödeme planı alanlarından ayrı bir gider bilgisini aynı kart ekranında göstererek finans akışını karıştırıyordu.

# Changes Made

- Müşteri Detayı sayfasındaki `Giderler` paneli tamamen kaldırıldı.
- Bu panel için kullanılan `expenses` state'i ve `setExpenses` yükleme adımı kaldırıldı.
- Müşteri detay API yanıtından bu karta özel `ak_expenses` sorgusu kaldırıldı.
- Gider verisi ve gider modülleri diğer admin alanlarında korunmuştur.

# Validation

- `npm run build`
- `php -l public_html/api/admin/customers.php`

# Commit Hash

- See pushed commit metadata for `Remove customer expenses card`.

# Full Diff

```diff
diff --git a/public_html/api/admin/customers.php b/public_html/api/admin/customers.php
index ff7943e..3e5d2c0 100644
--- a/public_html/api/admin/customers.php
+++ b/public_html/api/admin/customers.php
@@ -20,7 +20,6 @@ try {
                 'projects' => fetch_all('SELECT id, title, slug FROM ak_projects ORDER BY sort_order ASC, created_at DESC'),
                 'payment_plans' => fetch_all('SELECT * FROM ak_payment_plans WHERE customer_id = :id ORDER BY due_date ASC', ['id' => $id]),
                 'payments' => fetch_all('SELECT * FROM ak_payments WHERE customer_id = :id ORDER BY payment_date DESC', ['id' => $id]),
-                'expenses' => fetch_all('SELECT * FROM ak_expenses WHERE customer_id = :id ORDER BY expense_date DESC', ['id' => $id]),
                 'notes' => fetch_all('SELECT * FROM ak_customer_notes WHERE customer_id = :id ORDER BY created_at DESC', ['id' => $id]),
                 'documents' => fetch_all('SELECT * FROM ak_documents WHERE customer_id = :id ORDER BY created_at DESC', ['id' => $id]),
             ]);
diff --git a/src/pages/admin/AdminCustomerDetail.tsx b/src/pages/admin/AdminCustomerDetail.tsx
index c7e5971..578b8f5 100644
--- a/src/pages/admin/AdminCustomerDetail.tsx
+++ b/src/pages/admin/AdminCustomerDetail.tsx
@@ -82,7 +82,6 @@ export default function AdminCustomerDetail() {
   const [allProjects, setAllProjects] = useState<any[]>([]);
   const [plans, setPlans] = useState<any[]>([]);
   const [pays, setPays] = useState<any[]>([]);
-  const [expenses, setExpenses] = useState<any[]>([]);
   const [notes, setNotes] = useState<any[]>([]);
   const [docs, setDocs] = useState<any[]>([]);
   const [newNote, setNewNote] = useState("");
@@ -109,7 +108,6 @@ export default function AdminCustomerDetail() {
       setProjects((data.projects || []).filter((p) => linkedIds.includes(p.id)));
       setPlans(data.payment_plans || []);
       setPays(data.payments || []);
-      setExpenses(data.expenses || []);
       setNotes(data.notes || []);
       setDocs(data.documents || []);
     } catch (error) {
@@ -305,8 +303,8 @@ export default function AdminCustomerDetail() {
         }
       />
 
-      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
-        <div className="lg:col-span-2 bg-card border border-border rounded-md p-5 space-y-3">
+      <div className="mb-6">
+        <div className="bg-card border border-border rounded-md p-5 space-y-3">
           <h3 className="font-semibold">İletişim Bilgileri</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
             <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {customer.phone || "-"}</div>
@@ -326,19 +324,6 @@ export default function AdminCustomerDetail() {
           {customer.notes && <div><h4 className="font-semibold mt-4 mb-1">Genel Notlar</h4><p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p></div>}
         </div>
 
-        <div className="bg-card border border-border rounded-md p-5">
-          <h3 className="font-semibold mb-2">Giderler</h3>
-          <div className="text-sm text-muted-foreground">Müşteriye bağlı giderler hesap türüne ayrılmadan genel bilgi olarak gösterilir.</div>
-          <div className="mt-4 space-y-2">
-            {expenses.slice(0, 4).map((e) => (
-              <div key={e.id} className="flex items-center justify-between gap-3 text-sm">
-                <span className="truncate">{e.title}</span>
-                <span className="font-semibold tabular-nums">{formatTRY(e.amount)}</span>
-              </div>
-            ))}
-            {expenses.length === 0 && <div className="text-sm text-muted-foreground">Bu müşteriye bağlı gider kaydı bulunmuyor.</div>}
-          </div>
-        </div>
       </div>
 
       <Tabs defaultValue="resmi">
```
