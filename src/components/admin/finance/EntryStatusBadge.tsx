import { cn } from "@/lib/utils";
import type { CardEntryStatus } from "@/lib/apiTypes";

interface Props {
  status: CardEntryStatus | string;
  isOverdue?: number | boolean;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  Planlanan: "bg-blue-50 text-blue-700 border-blue-200",
  Gecikmiş: "bg-red-50 text-red-700 border-red-200",
  "Kısmi Ödendi": "bg-amber-50 text-amber-700 border-amber-200",
  Gerçekleşti: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Fazla Ödendi": "bg-purple-50 text-purple-700 border-purple-200",
};

export function EntryStatusBadge({ status, isOverdue, className }: Props) {
  const overdue = Boolean(isOverdue);

  // Unpaid + past → promote to Gecikmiş (no payment info is lost)
  const effectiveStatus = overdue && status === "Planlanan" ? "Gecikmiş" : status;

  // Partial + past → keep "Kısmi Ödendi" label, add overdue accent to border
  const isPartialOverdue = overdue && status === "Kısmi Ödendi";

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
          STATUS_STYLES[effectiveStatus] ?? "bg-muted text-muted-foreground border-border",
          isPartialOverdue && "border-red-400",
        )}
      >
        {effectiveStatus}
      </span>
      {isPartialOverdue && (
        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
          Gecikmiş
        </span>
      )}
    </span>
  );
}
