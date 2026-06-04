# Root Cause

- Payment rows were using due-date checks before payment presence for visual status.
- Partially paid past-due rows could appear as overdue/red even though the business rule says any paid amount must take green priority.
- Chart/card overdue buckets also included remaining amounts from partially paid rows, which made paid rows appear in red overdue totals.

# Changes Made

- Updated Müşteri payment rows so `paid > 0` displays as green before checking due date.
- Updated shared Personel/Tedarikçi finance rows with the same payment-first priority.
- Changed `Bekliyor` badge style to blue and `Kısmi Ödendi` badge style to green.
- Updated overdue card/chart buckets so red overdue totals only include unpaid rows.
- Kept partial paid remaining amounts in remaining/balance chart buckets so `Kalan` still calculates normally.

# Validation

- `npm run build`

# Commit Hash

- See pushed commit metadata for `Fix payment row color priority`.

# Full Diff

```diff
diff --git a/src/components/admin/finance/FinancialStatementPage.tsx b/src/components/admin/finance/FinancialStatementPage.tsx
index 25ca97a..c62e08c 100644
--- a/src/components/admin/finance/FinancialStatementPage.tsx
+++ b/src/components/admin/finance/FinancialStatementPage.tsx
@@ -873,10 +873,15 @@ export default function FinancialStatementPage({ kind, entityId }: FinancialStat
     });
     const futurePlans = enrichedPlans.filter((plan) => String(plan.due_date || "") > today && Number(plan.paid || 0) <= 0 && plan.computed !== "Ödendi" && plan.computed !== "İptal");
     const paid = enrichedPlans.reduce((sum, plan) => sum + Number(plan.paid || 0), 0);
-    const overdue = enrichedPlans.filter((plan) => daysUntil(plan.due_date || "") < 0 && plan.computed !== "Ödendi" && plan.computed !== "İptal").reduce((sum, plan) => sum + Number(plan.remain || 0), 0);
-    const futureRemaining = futureUnpaidPlans.reduce((sum, plan) => sum + Number(plan.remain || 0), 0);
+    const overdue = enrichedPlans
+      .filter((plan) => Number(plan.paid || 0) <= 0 && daysUntil(plan.due_date || "") < 0 && plan.computed !== "İptal")
+      .reduce((sum, plan) => sum + Number(plan.remain || 0), 0);
+    const paidRemaining = accountSummaryPlans
+      .filter((plan) => Number(plan.paid || 0) > 0 && plan.computed !== "Ödendi" && plan.computed !== "İptal")
+      .reduce((sum, plan) => sum + Number(plan.remain || 0), 0);
+    const futureRemaining = futureUnpaidPlans.reduce((sum, plan) => sum + Number(plan.remain || 0), 0) + paidRemaining;
     const currentDueRemaining = enrichedPlans
-      .filter((plan) => String(plan.due_date || "") === today && plan.computed !== "Ödendi" && plan.computed !== "İptal")
+      .filter((plan) => Number(plan.paid || 0) <= 0 && String(plan.due_date || "") === today && plan.computed !== "İptal")
       .reduce((sum, plan) => sum + Number(plan.remain || 0), 0);
@@ -1104,8 +1109,10 @@ export default function FinancialStatementPage({ kind, entityId }: FinancialStat
           </thead>
           <tbody>
             {rows.map((plan) => {
-              const isLate = String(plan.due_date || "") < today && plan.computed !== "Ödendi" && plan.computed !== "İptal" && Number(plan.remain || 0) > 0;
-              const label = isLate ? "Geciken Ödeme" : plan.computed || plan.status || "Bekliyor";
+              const hasPayment = Number(plan.paid || 0) > 0;
+              const isLate = !hasPayment && String(plan.due_date || "") < today && plan.computed !== "İptal" && Number(plan.remain || 0) > 0;
+              const displayStatus = hasPayment ? plan.computed || plan.status || "Bekliyor" : isLate ? "Vadesi Geçti" : "Bekliyor";
+              const label = hasPayment ? plan.computed || plan.status || "Bekliyor" : isLate ? "Geciken Ödeme" : "Bekliyor";
@@ -1120,7 +1127,7 @@ export default function FinancialStatementPage({ kind, entityId }: FinancialStat
-                  <td className="p-3"><span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", statusBadgeClass(isLate ? "Vadesi Geçti" : label))}>{label}</span></td>
+                  <td className="p-3"><span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", statusBadgeClass(displayStatus))}>{label}</span></td>
diff --git a/src/lib/finance.ts b/src/lib/finance.ts
index 9405de5..82be42d 100644
--- a/src/lib/finance.ts
+++ b/src/lib/finance.ts
@@ -159,8 +159,8 @@ export function daysUntil(date: string): number {
 export function statusBadgeClass(status: string): string {
   switch (displayLabel(status)) {
     case "Ödendi": return "bg-emerald-100 text-emerald-700 border-emerald-200";
-    case "Bekliyor": return "bg-slate-100 text-slate-700 border-slate-200";
-    case "Kısmi Ödendi": return "bg-amber-100 text-amber-700 border-amber-200";
+    case "Bekliyor": return "bg-blue-100 text-blue-700 border-blue-200";
+    case "Kısmi Ödendi": return "bg-emerald-100 text-emerald-700 border-emerald-200";
diff --git a/src/pages/admin/AdminCustomerDetail.tsx b/src/pages/admin/AdminCustomerDetail.tsx
index d783307..a2a1930 100644
--- a/src/pages/admin/AdminCustomerDetail.tsx
+++ b/src/pages/admin/AdminCustomerDetail.tsx
@@ -138,7 +138,7 @@ export default function AdminCustomerDetail() {
       const balance = unpaidPlans.reduce((s, p) => s + safeNumber(p.remain), 0);
       const totalDue = balance;
       const overdue = enrichedPlans
-        .filter((plan) => daysUntil(plan.due_date) < 0 && plan.computed !== "Ödendi" && plan.computed !== "İptal")
+        .filter((plan) => safeNumber(plan.paid) <= 0 && daysUntil(plan.due_date) < 0 && plan.computed !== "İptal")
         .reduce((sum, plan) => sum + plan.remain, 0);
@@ -169,12 +169,15 @@ export default function AdminCustomerDetail() {
       const overdue = accountSummaryRows
-        .filter((plan: any) => String(plan.due_date || "") < today && plan.computed !== "Ödendi" && plan.computed !== "İptal")
+        .filter((plan: any) => safeNumber(plan.paid) <= 0 && String(plan.due_date || "") < today && plan.computed !== "İptal")
         .reduce((sum: number, plan: any) => sum + Math.max(0, safeNumber(plan.remain)), 0);
       const currentDue = accountSummaryRows
-        .filter((plan: any) => String(plan.due_date || "") === today && plan.computed !== "Ödendi" && plan.computed !== "İptal")
+        .filter((plan: any) => safeNumber(plan.paid) <= 0 && String(plan.due_date || "") === today && plan.computed !== "İptal")
         .reduce((sum: number, plan: any) => sum + Math.max(0, safeNumber(plan.remain)), 0);
-      const futureRemaining = futureRows.reduce((sum: number, plan: any) => sum + Math.max(0, safeNumber(plan.remain)), 0);
+      const paidRemaining = accountSummaryRows
+        .filter((plan: any) => safeNumber(plan.paid) > 0 && plan.computed !== "Ödendi" && plan.computed !== "İptal")
+        .reduce((sum: number, plan: any) => sum + Math.max(0, safeNumber(plan.remain)), 0);
+      const futureRemaining = futureRows.reduce((sum: number, plan: any) => sum + Math.max(0, safeNumber(plan.remain)), 0) + paidRemaining;
@@ -405,8 +408,10 @@ export default function AdminCustomerDetail() {
                   {rows.map((p: any) => {
-                    const isLate = String(p.due_date || "") < today && p.computed !== "Ödendi" && p.computed !== "İptal" && safeNumber(p.remain) > 0;
-                    const label = isLate ? "Geciken Ödeme" : displayLabel(p.computed);
+                    const hasPayment = safeNumber(p.paid) > 0;
+                    const isLate = !hasPayment && String(p.due_date || "") < today && p.computed !== "İptal" && safeNumber(p.remain) > 0;
+                    const displayStatus = hasPayment ? p.computed : isLate ? "Vadesi Geçti" : "Bekliyor";
+                    const label = hasPayment ? displayLabel(p.computed) : isLate ? "Geciken Ödeme" : "Bekliyor";
@@ -423,7 +428,7 @@ export default function AdminCustomerDetail() {
-                        <td className="p-3"><span className={cn("px-2 py-0.5 rounded-md border text-xs", statusBadgeClass(isLate ? "Vadesi Geçti" : p.computed))}>{label}</span></td>
+                        <td className="p-3"><span className={cn("px-2 py-0.5 rounded-md border text-xs", statusBadgeClass(displayStatus))}>{label}</span></td>
```
