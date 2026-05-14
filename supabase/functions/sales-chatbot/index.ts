const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  // TODO: Confirm the final production domain before launch.
  "https://akinalinsaat.com",
  "https://www.akinalinsaat.com",
];

const baseCorsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;

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

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return baseCorsHeaders;
  }

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return null;
  }

  return {
    ...baseCorsHeaders,
    "Access-Control-Allow-Origin": origin,
  };
}

function jsonResponse(request: Request, body: unknown, status = 200) {
  const corsHeaders = getCorsHeaders(request);

  if (!corsHeaders) {
    return new Response(JSON.stringify({ error: "Bu origin için erişim izni yok." }), {
      status: 403,
      headers: {
        ...baseCorsHeaders,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function isRateLimited(request: Request) {
  const now = Date.now();
  const clientIp = getClientIp(request);
  const current = rateLimitStore.get(clientIp);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  current.count += 1;
  rateLimitStore.set(clientIp, current);
  return false;
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
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders ?? baseCorsHeaders,
    });
  }

  if (!corsHeaders) {
    return jsonResponse(request, { error: "Bu origin için erişim izni yok." }, 403);
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Bu uç nokta yalnızca POST isteği kabul eder." }, 405);
  }

  if (isRateLimited(request)) {
    return jsonResponse(
      request,
      { reply: "Çok kısa sürede fazla mesaj gönderildi. Lütfen bir dakika sonra tekrar deneyin veya WhatsApp üzerinden bize ulaşın." },
      429,
    );
  }

  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY Supabase secret olarak tanımlı değil.");
    return jsonResponse(request, { reply: FALLBACK_REPLY }, 200);
  }

  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const history = sanitizeHistory(body?.history);

    if (!message) {
      return jsonResponse(request, { error: "Mesaj alanı zorunludur." }, 400);
    }

    if (message.length > 1000) {
      return jsonResponse(request, { error: "Mesaj çok uzun. Lütfen daha kısa bir soru yazın." }, 400);
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
      return jsonResponse(request, { reply: FALLBACK_REPLY }, 200);
    }

    const data = await geminiResponse.json();
    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!reply) {
      return jsonResponse(request, { reply: FALLBACK_REPLY }, 200);
    }

    return jsonResponse(request, { reply });
  } catch (error) {
    console.error("Satış chatbot fonksiyonu hatası:", error);
    return jsonResponse(request, { reply: FALLBACK_REPLY }, 200);
  }
});
