import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type StatusRequest = { id: number | string };

const ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}

function err(message: string, status = 400) {
  return json({ error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "authorization, apikey, content-type",
        "access-control-max-age": "86400",
      },
    });
  }
  if (req.method !== "POST") return err("Method not allowed", 405);
  if (!ACCESS_TOKEN) return err("Missing Mercado Pago access token", 500);

  let body: StatusRequest | null = null;
  try {
    body = (await req.json()) as StatusRequest;
  } catch {
    return err("Invalid JSON body", 400);
  }

  const id = body?.id;
  if (!id) return err("Missing payment id", 422);

  try {
    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    const data = await resp.json();
    if (!resp.ok) {
      const msg = typeof data?.message === "string" ? data.message : "Mercado Pago error";
      return err(msg, resp.status);
    }
    const status = data?.status || null;
    const status_detail = data?.status_detail || null;
    const amount = data?.transaction_amount || null;
    return json({ status, status_detail, amount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return err(msg, 500);
  }
});