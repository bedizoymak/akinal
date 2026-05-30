import { useEffect, useMemo, useState } from "react";
import { BellRing, BellOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getAdminPushConfig, sendAdminPushTest, subscribeAdminPush, unsubscribeAdminPush } from "@/lib/apiClient";

type PushStatus = "checking" | "unsupported" | "not-configured" | "blocked" | "inactive" | "active";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export default function AdminPushNotificationsPanel() {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const statusLabel = useMemo(() => {
    if (status === "active") return "Bu cihazda açık";
    if (status === "blocked") return "Tarayıcı izni kapalı";
    if (status === "not-configured") return "Sunucu anahtarı eksik";
    if (status === "unsupported") return "Bu tarayıcı desteklemiyor";
    if (status === "checking") return "Kontrol ediliyor";
    return "Bu cihazda kapalı";
  }, [status]);

  useEffect(() => {
    let active = true;

    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (active) setStatus("unsupported");
        return;
      }

      try {
        const config = await getAdminPushConfig();
        if (!active) return;
        setPublicKey(config.public_key || "");
        if (!config.configured || !config.public_key) {
          setStatus("not-configured");
          return;
        }
        if (Notification.permission === "denied") {
          setStatus("blocked");
          return;
        }
        const registration = await navigator.serviceWorker.getRegistration("/admin-push-sw.js");
        const subscription = await registration?.pushManager.getSubscription();
        if (active) setStatus(subscription ? "active" : "inactive");
      } catch {
        if (active) setStatus("not-configured");
      }
    }

    void check();
    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    if (!publicKey || busy) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setStatus("blocked");
        toast({ title: "Bildirim izni kapalı", description: "Tarayıcı ayarlarından bildirim iznini açmanız gerekiyor.", variant: "destructive" });
        return;
      }
      if (permission !== "granted") {
        setStatus("inactive");
        return;
      }

      const registration = await navigator.serviceWorker.register("/admin-push-sw.js", { scope: "/" });
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await subscribeAdminPush(subscription.toJSON());
      setStatus("active");
      toast({ title: "Bildirimler açıldı", description: "Bu cihaz admin bildirimlerini alacak." });
    } catch (error) {
      toast({ title: "Bildirimler açılamadı", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/admin-push-sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeAdminPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("inactive");
      toast({ title: "Bildirimler kapatıldı", description: "Bu cihaz artık admin push bildirimi almayacak." });
    } catch (error) {
      toast({ title: "Bildirimler kapatılamadı", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await sendAdminPushTest();
      if (result.skipped) {
        toast({ title: "Test gönderilemedi", description: "Sunucuda VAPID anahtarları yapılandırılmamış.", variant: "destructive" });
        return;
      }
      if ((result.failed || 0) > 0) {
        const firstError = result.errors?.[0];
        toast({
          title: "Test bildirimi başarısız",
          description: firstError?.response || firstError?.message || firstError?.error || `${result.failed} cihaz başarısız.`,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Test bildirimi gönderildi", description: `${result.sent || 0} cihaz başarılı, ${result.failed || 0} cihaz başarısız.` });
    } catch (error) {
      toast({ title: "Test bildirimi gönderilemedi", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-surface-light p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <BellRing className="h-4 w-4 text-accent" />
            Tarayıcı Bildirimleri
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Sadece giriş yapan admin kullanıcıları bu cihazda bildirim açabilir.</p>
          <div className="mt-2 text-xs font-semibold text-muted-foreground">{statusLabel}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "active" ? (
            <Button type="button" variant="outline" onClick={disable} disabled={busy}>
              <BellOff className="h-4 w-4" />
              Bildirimleri Kapat
            </Button>
          ) : (
            <Button type="button" onClick={enable} disabled={busy || status === "unsupported" || status === "not-configured" || status === "blocked" || status === "checking"}>
              <BellRing className="h-4 w-4" />
              Bu cihazda bildirimleri aç
            </Button>
          )}
          <Button type="button" variant="outline" onClick={sendTest} disabled={busy || status !== "active"}>
            <Send className="h-4 w-4" />
            Test Bildirimi
          </Button>
        </div>
      </div>
    </div>
  );
}
