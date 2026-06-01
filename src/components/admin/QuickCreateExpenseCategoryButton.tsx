import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type QuickCreateExpenseCategoryButtonProps = {
  existingCategories: string[];
  onCreated: (category: string) => void;
};

export function QuickCreateExpenseCategoryButton({ existingCategories, onCreated }: QuickCreateExpenseCategoryButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: "Kategori adı zorunludur", variant: "destructive" });
      return;
    }

    const duplicate = existingCategories.find((category) => category.toLocaleLowerCase("tr-TR") === trimmed.toLocaleLowerCase("tr-TR"));
    onCreated(duplicate || trimmed);
    toast({ title: duplicate ? "Mevcut kategori seçildi" : "Kategori eklendi" });
    setName("");
    setOpen(false);
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Yeni Kategori
      </Button>

      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setName(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Gider Kategorisi</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Kategori Adı *</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save(); }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button onClick={save} className="bg-accent text-accent-foreground hover:bg-accent-glow">Ekle ve Seç</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
