import { type FormEvent, useEffect, useRef, useState } from "react";
import { Building2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ASSISTANT_NAME = "Akınal İnşaat Dijital Danışmanı";
const WHATSAPP_NUMBER = "+90 000 000 00 00";
const WHATSAPP_MESSAGE = "Merhaba, Akınal İnşaat hakkında bilgi almak istiyorum.";

const quickQuestions = [
  "Projeleriniz hakkında bilgi alabilir miyim?",
  "Kentsel dönüşüm yapıyor musunuz?",
  "Satış temsilcisiyle görüşmek istiyorum.",
  "İletişim bilgileriniz nedir?",
];

type ChatMessage = {
  id: string;
  role: "assistant" | "visitor";
  text: string;
};

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "Merhaba, ben Akınal İnşaat Dijital Danışmanı. Projelerimiz, kentsel dönüşüm ve satış süreçleri hakkında size hızlıca yardımcı olabilirim.",
  },
];

function createMessage(role: ChatMessage["role"], text: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    text,
  };
}

function normalizeQuestion(question: string) {
  return question
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function includesAny(question: string, keywords: string[]) {
  return keywords.some((keyword) => question.includes(keyword));
}

function getRuleBasedResponse(question: string) {
  const normalizedQuestion = normalizeQuestion(question);

  if (includesAny(normalizedQuestion, ["proje", "projeler"])) {
    return "Projelerimiz hakkında genel bilgi paylaşabiliriz. Devam eden ve tamamlanan projeler, lokasyonlar ve uygun seçenekler için Projelerimiz sayfasını inceleyebilir veya WhatsApp üzerinden satış ekibimizle görüşebilirsiniz.";
  }

  if (includesAny(normalizedQuestion, ["kentsel", "donusum", "kat karsiligi", "bina yenileme"])) {
    return "Evet, kentsel dönüşüm süreçlerinde planlama, ruhsat, uygulama ve teslim aşamalarında profesyonel destek sağlıyoruz. Binanız veya arsanızla ilgili ön değerlendirme için WhatsApp üzerinden bize ulaşabilirsiniz.";
  }

  if (includesAny(normalizedQuestion, ["satis", "fiyat", "daire", "konut", "metrekare", "m2"])) {
    return "Satış, fiyat ve daire bilgileri projenin lokasyonuna, daire tipine ve teslim durumuna göre değişebilir. En güncel ve net bilgi için satış temsilcimizle WhatsApp üzerinden görüşmenizi öneririz.";
  }

  if (includesAny(normalizedQuestion, ["iletisim", "telefon", "whatsapp", "arama", "ulasim"])) {
    return "Bize telefon veya WhatsApp üzerinden ulaşabilirsiniz. Aşağıdaki WhatsApp butonu ile doğrudan satış ekibimize mesaj gönderebilirsiniz.";
  }

  if (includesAny(normalizedQuestion, ["adres", "konum", "lokasyon", "harita", "nerede"])) {
    return "Adres ve konum bilgilerini İletişim sayfamızda görebilirsiniz. Randevu, yol tarifi veya proje görüşmesi için WhatsApp üzerinden bize yazabilirsiniz.";
  }

  return "Sorunuzu tam anlayamadım. Projeler, kentsel dönüşüm, satış ve iletişim konularında yardımcı olabilirim. Dilerseniz WhatsApp üzerinden satış ekibimize doğrudan yazabilirsiniz.";
}

function getWhatsAppUrl() {
  const digits = WHATSAPP_NUMBER.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
}

export default function SalesChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [isOpen, messages]);

  function sendMessage(text: string) {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    setMessages((currentMessages) => [
      ...currentMessages,
      createMessage("visitor", trimmedText),
      createMessage("assistant", getRuleBasedResponse(trimmedText)),
    ]);
    setInput("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-3 sm:right-5 md:bottom-28 md:right-6">
      {isOpen && (
        <section
          aria-label="Akınal İnşaat satış sohbeti"
          className="w-[calc(100vw-2rem)] max-w-[380px] overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-elegant animate-in fade-in slide-in-from-bottom-3 zoom-in-95 duration-200"
        >
          <div className="bg-gradient-dark px-4 py-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/12 ring-1 ring-white/20">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-sans text-sm font-bold leading-tight tracking-normal">{ASSISTANT_NAME}</h2>
                  <p className="mt-1 text-xs text-white/75">Size nasıl yardımcı olabiliriz?</p>
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
            <div className="max-h-[260px] space-y-3 overflow-y-auto pr-1">
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
                Hızlı Sorular
              </div>
              <div className="grid gap-2">
                {quickQuestions.map((question) => (
                  <Button
                    key={question}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => sendMessage(question)}
                    className="h-auto justify-start whitespace-normal rounded-md px-3 py-2 text-left text-xs leading-relaxed hover:border-accent hover:bg-accent/5"
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>

            <Button asChild className="w-full bg-[#25D366] font-semibold text-white hover:bg-[#1fb856]">
              <a href={getWhatsAppUrl()} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" />
                WhatsApp ile Görüş
              </a>
            </Button>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Sorunuzu yazın..."
                aria-label="Mesajınız"
                className="h-10 text-sm"
              />
              <Button type="submit" size="icon" aria-label="Mesaj gönder" title="Mesaj gönder" className="h-10 w-10 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </section>
      )}

      <Button
        type="button"
        aria-label={isOpen ? "Dijital danışmanı kapat" : "Dijital danışmanı aç"}
        title={isOpen ? "Dijital danışmanı kapat" : "Dijital danışmanı aç"}
        onClick={() => setIsOpen((current) => !current)}
        className="group h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-accent-glow transition-transform duration-200 hover:scale-105 hover:bg-primary-glow md:h-16 md:w-16"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100 md:block">
          Dijital Danışman
        </span>
      </Button>
    </div>
  );
}
