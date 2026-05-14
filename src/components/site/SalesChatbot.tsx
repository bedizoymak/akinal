import { type FormEvent, useEffect, useRef, useState } from "react";
import { Building2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const ASSISTANT_NAME = "Akınal İnşaat Dijital Danışmanı";
const WHATSAPP_NUMBER = "+90 000 000 00 00";
const WHATSAPP_MESSAGE = "Merhaba, Akınal İnşaat hakkında bilgi almak istiyorum.";
const FALLBACK_REPLY =
  "Şu anda dijital danışman yanıt veremiyor. Dilerseniz WhatsApp üzerinden satış ekibimize doğrudan ulaşabilirsiniz.";

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
  isLoading?: boolean;
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

function getWhatsAppUrl() {
  const digits = WHATSAPP_NUMBER.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
}

function getHistoryForFunction(messages: ChatMessage[]) {
  return messages
    .filter((message) => !message.isLoading)
    .slice(-8)
    .map((message) => ({
      role: message.role,
      text: message.text,
    }));
}

export default function SalesChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [isOpen, messages]);

  async function sendMessage(text: string) {
    const trimmedText = text.trim();
    if (!trimmedText || isSending) return;

    const visitorMessage = createMessage("visitor", trimmedText);
    const loadingMessage = {
      ...createMessage("assistant", "Yanıt hazırlanıyor..."),
      isLoading: true,
    };
    const history = getHistoryForFunction(messages);

    setMessages((currentMessages) => [
      ...currentMessages,
      visitorMessage,
      loadingMessage,
    ]);
    setInput("");
    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("sales-chatbot", {
        body: {
          message: trimmedText,
          history,
        },
      });

      const reply = typeof data?.reply === "string" && data.reply.trim().length > 0 ? data.reply.trim() : FALLBACK_REPLY;

      if (error) {
        console.error("Satış chatbot fonksiyon hatası:", error);
      }

      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === loadingMessage.id
            ? {
                ...message,
                text: error ? FALLBACK_REPLY : reply,
                isLoading: false,
              }
            : message,
        ),
      );
    } catch (error) {
      console.error("Satış chatbot bağlantı hatası:", error);
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === loadingMessage.id
            ? {
                ...message,
                text: FALLBACK_REPLY,
                isLoading: false,
              }
            : message,
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
                Hızlı Sorular
              </div>
              <div className="grid gap-2">
                {quickQuestions.map((question) => (
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
                disabled={isSending}
                className="h-10 text-sm"
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Mesaj gönder"
                title="Mesaj gönder"
                disabled={isSending}
                className="h-10 w-10 shrink-0"
              >
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
