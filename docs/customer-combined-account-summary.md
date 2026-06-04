# Root Cause

- Müşteri Detayı only showed separate `Resmi Hesap` and `Gayri Resmi Hesap` summaries inside account tabs.
- Users needed a combined receivable view before drilling into account-specific tabs.
- The old `Giderler` card had already been removed and remains absent from the customer detail page.

# Changes Made

- Added `Genel Hesap Özeti` below customer information.
- Combined `Resmi + Gayri Resmi` totals for:
  - Toplam Alacak
  - Tahsil Edilen
  - Müşteri Bakiyesi
  - Vadesi Geçen Tutar
  - Yaklaşan Ödeme
- Added a horizontal stacked bar chart for:
  - Tahsil Edilen
  - Vadesi Geçen
  - Kalan Alacak
- Kept existing account tabs, tab cards, tab tables, and pie charts unchanged.

# Validation

- `npm run build`

# Commit Hash

- See pushed commit metadata for `Add combined customer account summary`.

# Full Diff

```diff
diff --git a/src/pages/admin/AdminCustomerDetail.tsx b/src/pages/admin/AdminCustomerDetail.tsx
index 578b8f5..d783307 100644
--- a/src/pages/admin/AdminCustomerDetail.tsx
+++ b/src/pages/admin/AdminCustomerDetail.tsx
@@ -11,7 +11,7 @@ import { ArrowLeft, Edit, Mail, MapPin, MessageCircle, Phone, Plus, Trash2 } fro
 import { accountType, allocateCollectionsToPlans, customerDisplayName, derivePlanStatus, displayLabel, formatTRY, formatDate, statusBadgeClass, daysUntil, safeNumber, whatsappLink } from "@/lib/finance";
 import { cn } from "@/lib/utils";
 import { useToast } from "@/hooks/use-toast";
-import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
+import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
 import { AdminPageHeader } from "@/components/admin/AdminPage";
 import { createAdminCustomerNote, createAdminPaymentPlan, deleteAdminCustomerNote, deleteAdminPaymentPlan, getAdminCustomerDetail, updateAdminPaymentPlan } from "@/lib/apiClient";
 
@@ -191,6 +191,27 @@ export default function AdminCustomerDetail() {
     };
   }, [accountSummaries, today]);
 
+  const combinedAccountSummary = useMemo(() => {
+    const summaries = ACCOUNT_TABS.map((account) => accountSummaries[account.value] || {});
+    const totalDue = summaries.reduce((sum, summary) => sum + safeNumber(summary.totalDue), 0);
+    const totalPaid = summaries.reduce((sum, summary) => sum + safeNumber(summary.totalPaid), 0);
+    const totalAmount = summaries.reduce((sum, summary) => sum + safeNumber(summary.totalAmount), 0);
+    const balance = summaries.reduce((sum, summary) => sum + safeNumber(summary.balance), 0);
+    const overdue = summaries.reduce((sum, summary) => sum + safeNumber(summary.overdue), 0);
+    const upcoming = summaries.reduce((sum, summary) => sum + safeNumber(summary.upcoming), 0);
+    const remainingReceivable = Math.max(0, balance - overdue);
+    return {
+      totalDue,
+      totalPaid,
+      totalAmount,
+      balance,
+      overdue,
+      upcoming,
+      remainingReceivable,
+      chart: [{ name: "Genel", paid: totalPaid, overdue, remaining: remainingReceivable }],
+    };
+  }, [accountSummaries]);
+
   async function addNote() {
     if (!id || !newNote.trim()) return;
     await createAdminCustomerNote(id, newNote.trim());
@@ -326,6 +347,42 @@ export default function AdminCustomerDetail() {
 
       </div>
 
+      <section className="mb-6 rounded-md border border-border bg-card p-5 shadow-card-soft">
+        <div className="mb-4 flex flex-col gap-1">
+          <h3 className="font-semibold">Genel Hesap Özeti</h3>
+          <p className="text-sm text-muted-foreground">Resmi ve gayri resmi hesapların toplam müşteri alacak görünümü.</p>
+        </div>
+        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
+          <Stat label="Toplam Alacak" value={formatTRY(combinedAccountSummary.totalDue)} />
+          <Stat label="Tahsil Edilen" value={formatTRY(combinedAccountSummary.totalPaid)} color="text-emerald-700" />
+          <Stat label="Müşteri Bakiyesi" value={`${formatTRY(combinedAccountSummary.totalPaid)} / ${formatTRY(combinedAccountSummary.totalAmount)}`} color={combinedAccountSummary.balance > 0 ? "text-red-600" : "text-emerald-700"} />
+          <Stat label="Vadesi Geçen Tutar" value={formatTRY(combinedAccountSummary.overdue)} color="text-red-600" />
+          <Stat label="Yaklaşan Ödeme" value={formatTRY(combinedAccountSummary.upcoming)} color="text-amber-600" />
+        </div>
+        <div className="mt-5 rounded-md border border-border bg-muted/20 p-4">
+          <div className="mb-3 text-sm font-semibold">Toplam Tahsilat ve Alacak Dağılımı</div>
+          {(combinedAccountSummary.totalPaid + combinedAccountSummary.balance) > 0 ? (
+            <ResponsiveContainer width="100%" height={92}>
+              <BarChart data={combinedAccountSummary.chart} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
+                <XAxis type="number" hide domain={[0, "dataMax"]} />
+                <YAxis type="category" dataKey="name" hide />
+                <Tooltip formatter={(value: any, name: any) => [formatTRY(value), name === "paid" ? "Tahsil Edilen" : name === "overdue" ? "Vadesi Geçen" : "Kalan Alacak"]} />
+                <Bar dataKey="paid" stackId="summary" fill="#15803d" radius={[6, 0, 0, 6]} />
+                <Bar dataKey="overdue" stackId="summary" fill="#dc2626" />
+                <Bar dataKey="remaining" stackId="summary" fill="#2563eb" radius={[0, 6, 6, 0]} />
+              </BarChart>
+            </ResponsiveContainer>
+          ) : (
+            <div className="py-8 text-center text-sm text-muted-foreground">Bu müşteri için hesap özeti verisi bulunmuyor.</div>
+          )}
+          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
+            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-700" /> Tahsil Edilen</span>
+            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-600" /> Vadesi Geçen</span>
+            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-600" /> Kalan Alacak</span>
+          </div>
+        </div>
+      </section>
+
       <Tabs defaultValue="resmi">
         <TabsList className="flex flex-wrap">
           {ACCOUNT_TABS.map((account) => (
```
