import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Building2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getWhatsAppLink, useSiteSettings } from "@/hooks/useSiteSettings";
import { cn } from "@/lib/utils";

const ASSISTANT_NAME = "Akınal İnşaat Dijital Danışmanı";
const MESSAGE_LIMIT = 500;

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "Merhaba, ben Akınal İnşaat Dijital Danışmanı. Projelerimiz, kentsel dönüşüm ve iletişim konularında size yardımcı olabilirim.",
  },
];

const quickActions = [
  "Projeleriniz hakkında bilgi almak istiyorum",
  "Kentsel dönüşüm hakkında bilgi almak istiyorum",
  "Kat karşılığı inşaat yapıyor musunuz?",
  "Satış temsilcisiyle görüşmek istiyorum",
  "İletişim bilgilerinizi paylaşır mısınız?",
];

type ChatMessage = {
  id: string;
  role: "assistant" | "visitor";
  text: string;
  isLoading?: boolean;
  isError?: boolean;
};

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
    return "İletişim bilgileri ve konum için İletişim sayfasını ziyaret edebilirsiniz: /iletisim. Dilerseniz aşağıdaki WhatsApp butonuyla doğrudan satış ekibine bağlanabilirsiniz.";
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
    const loadingMessage = createMessage("assistant", "Yanıt hazırlanıyor...", { isLoading: true });

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
    <div className="fixed bottom-24 right-5 z-40 flex flex-col items-end gap-3 md:bottom-28 md:right-6">
      {isOpen && (
        <section
          aria-label="Akınal İnşaat dijital danışmanı"
          className="w-[calc(100vw-2rem)] max-w-[420px] overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-elegant animate-in fade-in slide-in-from-bottom-3 zoom-in-95 duration-200"
        >
          <div className="bg-gradient-dark px-4 py-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/12 ring-1 ring-white/20">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-sans text-sm font-bold leading-tight tracking-normal">{ASSISTANT_NAME}</h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-100 ring-1 ring-emerald-300/25">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      Aktif
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/75">Projeler, kentsel dönüşüm ve iletişim için yardımcı olur.</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Sohbeti kapat"
                title="Sohbeti kapat"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 shrink-0 text-white hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="max-h-[310px] space-y-3 overflow-y-auto pr-1">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex animate-in fade-in slide-in-from-bottom-1 duration-150",
                    message.role === "visitor" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[86%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                      message.role === "visitor"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-surface-light text-foreground",
                      message.isLoading && "text-muted-foreground",
                    )}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Hızlı Başlangıç
              </div>
              <div className="grid gap-2">
                {quickActions.map((question) => (
                  <Button
                    key={question}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSending}
                    onClick={() => sendMessage(question)}
                    className="h-auto justify-start whitespace-normal rounded-md px-3 py-2 text-left text-xs leading-relaxed hover:border-accent hover:bg-accent/5"
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>

            <Button asChild className="w-full bg-[#25D366] font-semibold text-white hover:bg-[#1fb856]">
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" />
                WhatsApp ile Satış Ekibine Bağlan
              </a>
            </Button>

            <form onSubmit={handleSubmit} className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(event) => handleInputChange(event.target.value)}
                  placeholder="Sorunuzu yazın..."
                  aria-label="Mesajınız"
                  disabled={isSending}
                  className="h-10 text-sm"
                />
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Mesaj gönder"
                  title="Mesaj gönder"
                  disabled={isSending || !input.trim()}
                  className="h-10 w-10 shrink-0"
                >
                  {isSending ? <Bot className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-start justify-between gap-3 text-[11px] text-muted-foreground">
                <span className={cn(formError && "font-medium text-destructive")}>
                  {formError || "Konuşma yapay zeka desteklidir; kesin bilgiler için satış ekibiyle görüşünüz."}
                </span>
                <span className="shrink-0">{input.length}/{MESSAGE_LIMIT}</span>
              </div>
            </form>
          </div>
        </section>
      )}

      <Button
        type="button"
        aria-label={isOpen ? "Dijital danışmanı kapat" : "Dijital danışmanı aç"}
        title={isOpen ? "Dijital danışmanı kapat" : "Dijital danışmanı aç"}
        onClick={() => setIsOpen((current) => !current)}
        className="group h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-accent-glow transition-all duration-200 hover:scale-105 hover:bg-primary-glow md:h-16 md:w-16"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100 md:block">
          Dijital Danışman
        </span>
      </Button>
    </div>
  );
}
