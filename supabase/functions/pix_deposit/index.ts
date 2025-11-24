import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type PixRequest = {
  amount: number;
  description?: string;
  email?: string;
  idempotencyKey?: string;
};

const ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-requested-with, accept",
      "access-control-expose-headers": "*",
    },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    const acrh = req.headers.get("access-control-request-headers") || "authorization, apikey, content-type, x-client-info, x-requested-with, accept";
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": acrh,
        "access-control-max-age": "86400",
      },
    });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  if (!ACCESS_TOKEN) {
    return errorResponse("Missing Mercado Pago access token", 500);
  }

  let body: PixRequest | null = null;
  try {
    body = (await req.json()) as PixRequest;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const amount = Number(body?.amount ?? 0);
  const description = (body?.description || "GiroClub • Depósito via Pix").slice(0, 140);
  const email = (body?.email || "comprador+pix@giroclub.app").toString();
  const idempotencyKey = (body?.idempotencyKey || crypto.randomUUID()).toString();

  if (!Number.isFinite(amount) || amount <= 0) {
    return errorResponse("Invalid amount", 422);
  }

  try {
    const resp = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "content-type": "application/json",
        "x-idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description,
        payment_method_id: "pix",
        payer: { email },
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return jsonResponse({ error: data }, resp.status);
    }

    const qr = data?.point_of_interaction?.transaction_data?.qr_code_base64 || null;
    const code = data?.point_of_interaction?.transaction_data?.qr_code || null;
    const id = data?.id || null;

    return jsonResponse({ id, qr_code_base64: qr, qr_code: code });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return jsonResponse({ error: msg }, 500);
  }
});