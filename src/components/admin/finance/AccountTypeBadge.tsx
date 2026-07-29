import { cn } from "@/lib/utils";

interface Props {
  accountType: "resmi" | "gayri_resmi" | string | null | undefined;
  className?: string;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  resmi: "Resmi",
  gayri_resmi: "Gayri Resmi",
};

const ACCOUNT_TYPE_STYLES: Record<string, string> = {
  resmi: "bg-sky-50 text-sky-700 border-sky-200",
  gayri_resmi: "bg-orange-50 text-orange-700 border-orange-200",
};

// Records with no persisted account_type (e.g. government progress payments, which have no
// Resmi/Gayri Resmi column) show a neutral dash rather than a guessed classification.
export function AccountTypeBadge({ accountType, className }: Props) {
  const label = accountType ? (ACCOUNT_TYPE_LABELS[accountType] ?? accountType) : "—";
  const style = accountType ? (ACCOUNT_TYPE_STYLES[accountType] ?? "bg-muted text-muted-foreground border-border") : "bg-muted text-muted-foreground border-border";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", style, className)}>
      {label}
    </span>
  );
}
