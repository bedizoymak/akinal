import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CardFinancialEntry, CardEntryCurrency, CardEntryAccountType, CardEntryPaymentMethod } from "@/lib/apiTypes";

const CURRENCIES: { value: CardEntryCurrency; label: string }[] = [
  { value: "TRY", label: "₺ Türk Lirası" },
  { value: "USD", label: "$ Dolar" },
  { value: "EUR", label: "€ Euro" },
  { value: "XAU_GRAM", label: "gr Altın" },
];

const PAYMENT_METHODS: CardEntryPaymentMethod[] = ["Nakit", "Banka Havalesi/EFT", "Kredi Kartı", "Çek", "Senet", "Diğer"];

export interface CardEntryFormValues {
  title: string;
  notes: string;
  entry_date: string;
  amount: string;
  paid_amount: string;
  currency: CardEntryCurrency;
  exchange_rate_to_try: string;
  is_exchange_rate_manual: boolean;
  account_type: CardEntryAccountType;
  payment_method: CardEntryPaymentMethod;
  project_id: string;
}

interface Project {
  id: string;
  title: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (values: CardEntryFormValues) => Promise<void>;
  initial?: Partial<CardFinancialEntry>;
  projects: Project[];
  title?: string;
  direction?: "income" | "expense";
}

const today = () => new Date().toISOString().slice(0, 10);

function defaultValues(initial?: Partial<CardFinancialEntry>): CardEntryFormValues {
  return {
    title: initial?.title ?? "",
    notes: initial?.notes ?? "",
    entry_date: initial?.entry_date ?? today(),
    amount: initial?.amount != null ? String(initial.amount) : "",
    paid_amount: initial?.paid_amount != null ? String(initial.paid_amount) : "0",
    currency: (initial?.currency as CardEntryCurrency) ?? "TRY",
    exchange_rate_to_try: initial?.exchange_rate_to_try != null ? String(initial.exchange_rate_to_try) : "1",
    is_exchange_rate_manual: Boolean(initial?.is_exchange_rate_manual),
    account_type: (initial?.account_type as CardEntryAccountType) ?? "resmi",
    payment_method: (initial?.payment_method as CardEntryPaymentMethod) ?? "Nakit",
    project_id: initial?.project_id ?? "",
  };
}

export function CardEntryForm({ open, onClose, onSave, initial, projects, title, direction }: Props) {
  const [values, setValues] = useState<CardEntryFormValues>(defaultValues(initial));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues(defaultValues(initial));
      setError(null);
    }
  }, [open, initial]);

  function set<K extends keyof CardEntryFormValues>(key: K, val: CardEntryFormValues[K]) {
    setValues((prev) => {
      const next = { ...prev, [key]: val };
      if (key === "currency" && val === "TRY") {
        next.exchange_rate_to_try = "1";
        next.is_exchange_rate_manual = false;
      }
      return next;
    });
  }

  async function handleSave() {
    if (!values.title.trim()) { setError("Başlık zorunludur."); return; }
    if (!values.entry_date) { setError("Tarih zorunludur."); return; }
    if (!values.amount || isNaN(Number(values.amount)) || Number(values.amount) <= 0) { setError("Geçerli bir tutar girin."); return; }
    setLoading(true);
    setError(null);
    try {
      await onSave(values);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kayıt sırasında hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  const isTry = values.currency === "TRY";
  const directionLabel = direction === "income" ? "Gelir" : direction === "expense" ? "Gider" : "";
  const formTitle = title ?? (initial?.id ? `${directionLabel} Kaydı Düzenle` : `${directionLabel} Kaydı Ekle`);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{formTitle}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Başlık *</Label>
              <Input value={values.title} onChange={(e) => set("title", e.target.value)} placeholder="Tahsilat / Ödeme başlığı" />
            </div>

            <div>
              <Label>Tarih *</Label>
              <Input type="date" value={values.entry_date} onChange={(e) => set("entry_date", e.target.value)} />
            </div>

            <div>
              <Label>Proje</Label>
              <Select value={values.project_id || "__none__"} onValueChange={(v) => set("project_id", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Proje seç (isteğe bağlı)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Seçilmedi</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Para Birimi</Label>
              <Select value={values.currency} onValueChange={(v) => set("currency", v as CardEntryCurrency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {!isTry && (
              <div>
                <Label>Kur (TRY) {values.is_exchange_rate_manual && <span className="text-[10px] text-amber-600">Manuel</span>}</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={values.exchange_rate_to_try}
                  onChange={(e) => { set("exchange_rate_to_try", e.target.value); set("is_exchange_rate_manual", true); }}
                  placeholder="1.00"
                />
              </div>
            )}

            <div>
              <Label>Toplam Tutar ({values.currency}) *</Label>
              <Input type="number" step="0.01" value={values.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" />
            </div>

            <div>
              <Label>Ödenen / Tahsil Edilen ({values.currency})</Label>
              <Input type="number" step="0.01" value={values.paid_amount} onChange={(e) => set("paid_amount", e.target.value)} placeholder="0.00" />
            </div>

            <div>
              <Label>Hesap Türü</Label>
              <Select value={values.account_type} onValueChange={(v) => set("account_type", v as CardEntryAccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="resmi">Resmi</SelectItem>
                  <SelectItem value="gayri_resmi">Gayri Resmi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ödeme Yöntemi</Label>
              <Select value={values.payment_method} onValueChange={(v) => set("payment_method", v as CardEntryPaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>Notlar</Label>
              <Textarea value={values.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="İsteğe bağlı not" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>İptal</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? "Kaydediliyor..." : "Kaydet"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
