import type { CardEntryCurrency } from "@/lib/apiTypes";

interface Props {
  amount: number | string;
  currency?: CardEntryCurrency | string;
  amountTry?: number | string;
  showTry?: boolean;
  className?: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
  XAU_GRAM: "gr",
};

function fmt(v: number | string, decimals = 2) {
  return Number(v).toLocaleString("tr-TR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function CurrencyAmount({ amount, currency = "TRY", amountTry, showTry = true, className }: Props) {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  const main = `${sym}${fmt(amount)}`;
  const isTry = currency === "TRY";
  const tryStr = !isTry && showTry && amountTry != null ? `(₺${fmt(amountTry)})` : null;

  return (
    <span className={className}>
      {main}
      {tryStr && <span className="ml-1 text-[11px] text-muted-foreground">{tryStr}</span>}
    </span>
  );
}
