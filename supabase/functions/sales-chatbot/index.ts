const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatMessage = {
  role: "assistant" | "visitor";
  text: string;
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const WHATSAPP_NUMBER = Deno.env.get("CHATBOT_WHATSAPP_NUMBER") ?? "+90 000 000 00 00";
const MODEL_NAME = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

const FALLBACK_REPLY =
  "Şu anda dijital danışman yanıt veremiyor. Dilerseniz WhatsApp üzerinden satış ekibimize doğrudan ulaşabilirsiniz.";

const systemInstruction = `
Sen "Akınal İnşaat Dijital Danışmanı" olarak konuşuyorsun.
Tüm cevapların Türkçe olmalı.
Cevapların kısa, profesyonel, güven veren ve satış odaklı olmalı.

Yalnızca şu konularda yardımcı ol:
- Akınal İnşaat
- inşaat projeleri
- kentsel dönüşüm
- satış ve daire bilgisi
- randevu
- iletişim
- konum
- genel şirket hizmetleri

Kesin kurallar:
- Hukuki, finansal, mühendislik, mimari, teslim tarihi, fiyat veya sözleşme garantisi verme.
- Kesin proje fiyatı, teslim tarihi, stok/uygunluk veya bağlayıcı taahhüt uydurma.
- Bilmediğin konularda uydurma yapma; kullanıcıyı nazikçe WhatsApp veya iletişim kanalına yönlendir.
- Ziyaretçinin adı, telefonu ve ilgilendiği proje/hizmet bilgisini yalnızca görüşme veya randevu için doğal olduğunda iste.
- Kişisel verileri kaydettiğini söyleme; henüz veri saklanmıyor.
- Konu dışı sorularda kısa şekilde kapsamını belirt ve WhatsApp/iletişime yönlendir.

WhatsApp yönlendirmesi gerektiğinde şu numarayı kullan: ${WHATSAPP_NUMBER}
`.trim();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function sanitizeHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return [];

  return history
    .filter((message): message is ChatMessage => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as Record<string, unknown>;
      return (
        (candidate.role === "assistant" || candidate.role === "visitor") &&
        typeof candidate.text === "string" &&
        candidate.text.trim().length > 0
      );
    })
    .slice(-8)
    .map((message) => ({
      role: message.role,
      text: message.text.trim().slice(0, 800),
    }));
}

function toGeminiRole(role: ChatMessage["role"]) {
  return role === "assistant" ? "model" : "user";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Bu uç nokta yalnızca POST isteği kabul eder." }, 405);
  }

  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY Supabase secret olarak tanımlı değil.");
    return jsonResponse({ reply: FALLBACK_REPLY }, 200);
  }

  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const history = sanitizeHistory(body?.history);

    if (!message) {
      return jsonResponse({ error: "Mesaj alanı zorunludur." }, 400);
    }

    if (message.length > 1000) {
      return jsonResponse({ error: "Mesaj çok uzun. Lütfen daha kısa bir soru yazın." }, 400);
    }

    const contents = [
      ...history.map((item) => ({
        role: toGeminiRole(item.role),
        parts: [{ text: item.text }],
      })),
      {
        role: "user",
        parts: [{ text: message }],
      },
    ];

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents,
          generationConfig: {
            temperature: 0.35,
            topP: 0.8,
            maxOutputTokens: 220,
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API hatası:", geminiResponse.status, errorText);
      return jsonResponse({ reply: FALLBACK_REPLY }, 200);
    }

    const data = await geminiResponse.json();
    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!reply) {
      return jsonResponse({ reply: FALLBACK_REPLY }, 200);
    }

    return jsonResponse({ reply });
  } catch (error) {
    console.error("Satış chatbot fonksiyonu hatası:", error);
    return jsonResponse({ reply: FALLBACK_REPLY }, 200);
  }
});
