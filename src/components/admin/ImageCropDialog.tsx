import { useCallback, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCw } from "lucide-react";

async function getCroppedBlob(imageSrc: string, area: Area, rotation: number): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = imageSrc;
  });
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const bw = image.width * cos + image.height * sin;
  const bh = image.width * sin + image.height * cos;

  const tmp = document.createElement("canvas");
  tmp.width = bw; tmp.height = bh;
  const tctx = tmp.getContext("2d")!;
  tctx.translate(bw / 2, bh / 2);
  tctx.rotate(rad);
  tctx.drawImage(image, -image.width / 2, -image.height / 2);

  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(tmp, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);

  const maxW = 1920;
  if (canvas.width > maxW) {
    const ratio = maxW / canvas.width;
    const out = document.createElement("canvas");
    out.width = maxW; out.height = Math.round(canvas.height * ratio);
    out.getContext("2d")!.drawImage(canvas, 0, 0, out.width, out.height);
    return new Promise((res) => out.toBlob((b) => res(b!), "image/jpeg", 0.88));
  }
  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.88));
}

const RATIOS = [
  { label: "16:9", value: 16 / 9 },
  { label: "4:3", value: 4 / 3 },
  { label: "1:1", value: 1 },
  { label: "Orijinal", value: 0 },
];

export default function ImageCropDialog({
  open, onOpenChange, src, onSave, defaultRatio = 16 / 9,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  src: string;
  onSave: (blob: Blob) => void;
  defaultRatio?: number;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState(defaultRatio);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onComplete = useCallback((_: Area, a: Area) => setArea(a), []);

  async function save() {
    if (!area) return;
    setBusy(true);
    const blob = await getCroppedBlob(src, area, rotation);
    onSave(blob);
    setBusy(false);
    onOpenChange(false);
  }

  function reset() { setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Görseli Kırp</DialogTitle></DialogHeader>
        <div className="relative h-[420px] bg-muted rounded-md overflow-hidden">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect || undefined}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onComplete}
              restrictPosition={false}
            />
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">Oran</div>
            <Select value={String(aspect)} onValueChange={(v) => setAspect(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RATIOS.map((r) => <SelectItem key={r.label} value={String(r.value)}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">Yakınlaştırma</div>
            <Slider min={1} max={4} step={0.05} value={[zoom]} onValueChange={(v) => setZoom(v[0])} />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-between">Döndürme <Button variant="ghost" size="sm" className="h-6" onClick={() => setRotation((r) => (r + 90) % 360)}><RotateCw className="h-3.5 w-3.5" /></Button></div>
            <Slider min={0} max={360} step={1} value={[rotation]} onValueChange={(v) => setRotation(v[0])} />
          </div>
        </div>
        <DialogFooter className="flex-row justify-between gap-2">
          <Button variant="ghost" onClick={reset}>Sıfırla</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button onClick={save} disabled={busy} className="bg-accent hover:bg-accent-glow text-accent-foreground">{busy ? "Kaydediliyor..." : "Kırpılmış Hâli Kaydet"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
