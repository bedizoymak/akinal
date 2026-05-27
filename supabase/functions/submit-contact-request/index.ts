const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://akinalinsaat.com",
  "https://www.akinalinsaat.com",
  "https://akinalinsaat.com.tr",
  "https://www.akinalinsaat.com.tr",
];

const baseCorsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 8;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

type ContactRequestBody = {
  full_name?: unknown;
  phone?: unknown;
  email?: unknown;
  service_type?: unknown;
  message?: unknown;
  turnstileToken?: unknown;
};

type ValidContactRequest = {
  full_name: string;
  phone: string;
  email: string | null;
  service_type: string;
  message: string;
  turnstileToken: string;
};

type TurnstileResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) return baseCorsHeaders;
  if (!ALLOWED_ORIGINS.includes(origin)) return null;

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

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) return true;

  current.count += 1;
  rateLimitStore.set(clientIp, current);
  return false;
}

async function parseJsonBody(request: Request) {
  try {
    return (await request.json()) as ContactRequestBody;
  } catch {
    return null;
  }
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validateBody(body: ContactRequestBody | null): { data?: ValidContactRequest; error?: string } {
  if (!body) return { error: "Geçersiz form isteği." };

  const fullName = normalizeString(body.full_name);
  const phone = normalizeString(body.phone);
  const email = body.email === null ? "" : normalizeString(body.email);
  const serviceType = normalizeString(body.service_type);
  const message = normalizeString(body.message);
  const turnstileToken = normalizeString(body.turnstileToken);

  if (fullName.length < 2 || fullName.length > 100) return { error: "Ad Soyad alanı geçersiz." };
  if (phone.length < 7 || phone.length > 30) return { error: "Telefon alanı geçersiz." };
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255)) {
    return { error: "E-posta alanı geçersiz." };
  }
  if (!serviceType) return { error: "Lütfen bir hizmet seçin." };
  if (message.length < 5 || message.length > 2000) return { error: "Mesaj alanı geçersiz." };
  if (!turnstileToken) return { error: "Güvenlik doğrulaması gerekli." };

  return {
    data: {
      full_name: fullName,
      phone,
      email: email || null,
      service_type: serviceType,
      message,
      turnstileToken,
    },
  };
}

async function verifyTurnstile(token: string, clientIp: string) {
  if (!TURNSTILE_SECRET_KEY) {
    console.error("TURNSTILE_SECRET_KEY Supabase secret olarak tanımlı değil.");
    return false;
  }

  const payload = new URLSearchParams({
    secret: TURNSTILE_SECRET_KEY,
    response: token,
  });

  if (clientIp !== "unknown") payload.set("remoteip", clientIp);

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload,
  });

  if (!response.ok) {
    console.error("Turnstile doğrulama isteği başarısız:", response.status);
    return false;
  }

  const data = (await response.json()) as TurnstileResponse;
  if (!data.success) {
    console.warn("Turnstile doğrulaması reddedildi:", data["error-codes"] ?? []);
    return false;
  }

  return true;
}

async function insertContactRequest(data: ValidContactRequest) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Supabase Edge Function için SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik.");
    return false;
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/contact_requests`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      full_name: data.full_name,
      phone: data.phone,
      email: data.email,
      service_type: data.service_type,
      message: data.message,
    }),
  });

  if (!response.ok) {
    console.error("İletişim talebi kaydedilemedi:", response.status, await response.text());
    return false;
  }

  return true;
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
    return jsonResponse(request, { error: "Çok kısa sürede fazla form gönderildi. Lütfen biraz sonra tekrar deneyin." }, 429);
  }

  const body = await parseJsonBody(request);
  const validation = validateBody(body);
  if (!validation.data) {
    return jsonResponse(request, { error: validation.error ?? "Form bilgileri geçersiz." }, 400);
  }

  const clientIp = getClientIp(request);
  const turnstilePassed = await verifyTurnstile(validation.data.turnstileToken, clientIp);
  if (!turnstilePassed) {
    return jsonResponse(request, { error: "Güvenlik doğrulaması tamamlanamadı." }, 403);
  }

  const saved = await insertContactRequest(validation.data);
  if (!saved) {
    return jsonResponse(request, { error: "Talebiniz kaydedilemedi." }, 500);
  }

  return jsonResponse(request, { ok: true });
});
