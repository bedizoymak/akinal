import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, MessageCircle, Mic, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getWhatsAppLink, useSiteSettings } from "@/hooks/useSiteSettings";
import { cn } from "@/lib/utils";

const ASSISTANT_NAME = "AKINAL Yapay Zeka Asistanı";
const MESSAGE_LIMIT = 500;

type ChatMessage = {
  id: string;
  role: "assistant" | "visitor";
  text: string;
  isLoading?: boolean;
  isError?: boolean;
};

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "Görüştüğümüze sevindim. Size nasıl yardımcı olabilirim?",
  },
];

const quickActions = [
  { label: "Projeler", message: "Projeleriniz hakkında bilgi almak istiyorum" },
  { label: "Kentsel Dönüşüm", message: "Kentsel dönüşüm hakkında bilgi almak istiyorum" },
  { label: "Kat Karşılığı", message: "Kat karşılığı inşaat yapıyor musunuz?" },
  { label: "Satış Görüşmesi", message: "Satış temsilcisiyle görüşmek istiyorum" },
  { label: "İletişim", message: "İletişim bilgilerinizi paylaşır mısınız?" },
];

function createMessage(role: ChatMessage["role"], text: string, extras?: Partial<ChatMessage>): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    text,
    ...extras,
  };
}

function normalizeMessage(message: string) {
  return message
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
}

function includesAny(message: string, keywords: string[]) {
  return keywords.some((keyword) => message.includes(keyword));
}

function getLocalFallbackResponse(question: string) {
  const normalized = normalizeMessage(question);

  if (includesAny(normalized, ["proje", "projeler"])) {
    return "Güncel projelerimizi Projelerimiz sayfasından inceleyebilirsiniz: /projelerimiz. Proje lokasyonu, daire tipi ve satış süreci gibi güncel detaylar için WhatsApp üzerinden satış ekibimizle görüşmeniz en doğru yol olur.";
  }

  if (includesAny(normalized, ["kentsel donusum", "donusum", "riskli yapi", "riskli bina"])) {
    return "Akınal İnşaat kentsel dönüşüm süreçlerinde ön değerlendirme, proje planlama ve uygulama konularında destek sağlar. Sürecin detayları yapı ve arsa durumuna göre değiştiği için ön görüşme için WhatsApp üzerinden ekibimize ulaşabilirsiniz. Kentsel dönüşüm sayfası: /kentsel-donusum";
  }

  if (includesAny(normalized, ["kat karsiligi", "arsa", "arsa sahibi"])) {
    return "Kat karşılığı inşaat için arsanın konumu, imar durumu ve proje potansiyeli ön değerlendirme gerektirir. Kesin oran veya sözleşme sonucu taahhüdü vermeden, ilk değerlendirme için satış ekibimizle WhatsApp üzerinden görüşebilirsiniz.";
  }

  if (includesAny(normalized, ["fiyat", "daire", "satis", "uygunluk", "stok", "metrekare", "m2"])) {
    return "Fiyat, daire uygunluğu ve satış koşulları güncel proje durumuna göre değişebilir. Buradan kesin fiyat veya uygunluk bilgisi veremem; satış ekibimiz size en güncel bilgiyi WhatsApp üzerinden paylaşabilir.";
  }

  if (includesAny(normalized, ["iletisim", "telefon", "whatsapp", "adres", "konum", "nerede", "ulasim"])) {
    return "İletişim bilgileri ve konum için İletişim sayfasını ziyaret edebilirsiniz: /iletisim. Dilerseniz satış ekibine bağlan bağlantısıyla doğrudan WhatsApp görüşmesi başlatabilirsiniz.";
  }

  if (includesAny(normalized, ["hizmet", "ne yapiyorsunuz", "ne is yapiyorsunuz", "insaat"])) {
    return "Akınal İnşaat; kentsel dönüşüm, kat karşılığı inşaat, anahtar teslim inşaat ve proje geliştirme alanlarında hizmet verir. İhtiyacınıza göre doğru yönlendirme için WhatsApp üzerinden kısa bir ön görüşme yapabilirsiniz.";
  }

  return "Bu konuda en doğru yönlendirmeyi satış ekibimiz yapabilir. Akınal İnşaat projeleri, kentsel dönüşüm, kat karşılığı inşaat ve iletişim konularında WhatsApp üzerinden bize ulaşabilirsiniz.";
}

function getHistoryForFunction(messages: ChatMessage[]) {
  return messages
    .filter((message) => !message.isLoading && !message.isError)
    .slice(-8)
    .map((message) => ({
      role: message.role,
      text: message.text,
    }));
}

function AssistantAvatar() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent ring-1 ring-accent/15">
      <Bot className="h-5 w-5" />
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>AKINAL yazıyor</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
      </span>
    </div>
  );
}

export default function SalesChatbot() {
  const { settings } = useSiteSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [formError, setFormError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const whatsappUrl = useMemo(
    () => getWhatsAppLink(settings.whatsapp_number, settings.whatsapp_message),
    [settings.whatsapp_number, settings.whatsapp_message],
  );

  const showCharacterCount = input.length >= 420 || Boolean(formError);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [isOpen, messages]);

  async function sendMessage(rawText: string) {
    const text = rawText.trim();
    if (!text || isSending) return;

    if (text.length > MESSAGE_LIMIT) {
      setFormError(`Mesajınız çok uzun. Lütfen ${MESSAGE_LIMIT} karakterden kısa bir soru yazın.`);
      return;
    }

    setFormError("");
    const history = getHistoryForFunction(messages);
    const visitorMessage = createMessage("visitor", text);
    const loadingMessage = createMessage("assistant", "AKINAL yazıyor...", { isLoading: true });

    setMessages((current) => [...current, visitorMessage, loadingMessage]);
    setInput("");
    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("sales-chatbot", {
        body: { message: text, history },
      });

      const fallbackReply = getLocalFallbackResponse(text);
      const reply = !error && typeof data?.reply === "string" && data.reply.trim() ? data.reply.trim() : fallbackReply;

      setMessages((current) =>
        current.map((message) =>
          message.id === loadingMessage.id ? { ...message, text: reply, isLoading: false } : message,
        ),
      );
    } catch {
      const fallbackReply = getLocalFallbackResponse(text);
      setMessages((current) =>
        current.map((message) =>
          message.id === loadingMessage.id ? { ...message, text: fallbackReply, isLoading: false } : message,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  function handleInputChange(value: string) {
    if (value.length <= MESSAGE_LIMIT) {
      setInput(value);
      setFormError("");
      return;
    }

    setInput(value.slice(0, MESSAGE_LIMIT));
    setFormError(`Mesajınız en fazla ${MESSAGE_LIMIT} karakter olabilir.`);
  }

  return (
    <>
      {isOpen && (
        <section
          aria-label="AKINAL Yapay Zeka Asistanı"
          className="fixed inset-0 z-40 flex h-[100dvh] w-full max-w-full flex-col overflow-hidden bg-background text-foreground shadow-elegant animate-in fade-in slide-in-from-bottom-3 duration-200 sm:inset-auto sm:bottom-28 sm:right-6 sm:h-[min(620px,calc(100dvh-8rem))] sm:w-[min(420px,calc(100vw-3rem))] sm:rounded-2xl sm:border sm:border-border sm:bg-card"
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-border/70 bg-card/95 px-4 py-4 backdrop-blur">
            <AssistantAvatar />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate font-sans text-sm font-bold tracking-normal text-foreground">{ASSISTANT_NAME}</h2>
                <span className="hidden shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100 min-[380px]:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Aktif
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">Projeler ve kentsel dönüşüm hakkında yardımcı olur.</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="hidden h-8 px-2 text-xs text-muted-foreground hover:text-accent min-[380px]:inline-flex">
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                Satış ekibine bağlan
              </a>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Sohbeti kapat"
              title="Sohbeti kapat"
              onClick={() => setIsOpen(false)}
              className="h-9 w-9 shrink-0 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-surface-light/60 to-background">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
              <div className="space-y-5">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex animate-in fade-in slide-in-from-bottom-1 duration-150",
                      message.role === "visitor" ? "justify-end" : "justify-start",
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="mr-2 mt-1 hidden sm:block">
                        <AssistantAvatar />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                        message.role === "visitor"
                          ? "rounded-br-md bg-accent text-accent-foreground"
                          : "rounded-bl-md bg-white text-foreground ring-1 ring-border/70",
                        message.isLoading && "bg-white text-muted-foreground",
                      )}
                    >
                      {message.isLoading ? <TypingBubble /> : message.text}
                    </div>
                  </div>
                ))}

                <div className="flex gap-2 overflow-x-auto pb-1 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      disabled={isSending}
                      onClick={() => sendMessage(action.message)}
                      className="shrink-0 rounded-full border border-border bg-white px-3.5 py-2 text-xs font-medium text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent/5 hover:text-accent disabled:pointer-events-none disabled:opacity-60"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
                <div ref={messagesEndRef} />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="shrink-0 border-t border-border/70 bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 sm:px-5 sm:pb-4">
              <div className="flex items-end gap-2 rounded-full border border-border bg-background px-2 py-2 shadow-sm focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/10">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled
                  aria-label="Sesli mesaj şu anda aktif değil"
                  title="Sesli mesaj şu anda aktif değil"
                  className="h-9 w-9 shrink-0 rounded-full text-muted-foreground"
                >
                  <Mic className="h-4 w-4" />
                </Button>
                <Input
                  value={input}
                  onChange={(event) => handleInputChange(event.target.value)}
                  placeholder="Bir mesaj yazın"
                  aria-label="Mesajınız"
                  disabled={isSending}
                  className="h-9 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Mesaj gönder"
                  title="Mesaj gönder"
                  disabled={isSending || !input.trim()}
                  className="h-9 w-9 shrink-0 rounded-full bg-accent text-accent-foreground hover:bg-accent-glow"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 flex min-h-4 items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground">
                <span className={cn(formError && "font-medium text-destructive")}>{formError}</span>
                {showCharacterCount && <span className="shrink-0">{input.length}/{MESSAGE_LIMIT}</span>}
              </div>
            </form>
          </div>
        </section>
      )}

      {!isOpen && (
        <Button
          type="button"
          aria-label="AKINAL Yapay Zeka Asistanı aç"
          title="AKINAL Yapay Zeka Asistanı aç"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-5 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-accent-glow transition-all duration-200 hover:scale-105 hover:bg-primary-glow md:bottom-28 md:right-6 md:h-16 md:w-16"
        >
          <span className="text-sm font-black tracking-wide">AI</span>
          <MessageCircle className="absolute -right-0.5 -top-0.5 h-5 w-5 rounded-full bg-accent p-1 text-accent-foreground ring-2 ring-background" />
        </Button>
      )}
    </>
  );
}
