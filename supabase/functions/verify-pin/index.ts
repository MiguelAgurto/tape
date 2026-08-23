// verify-pin — server-side PIN check. The browser never sees pin_hash.
//
// Deploy:  supabase functions deploy verify-pin --no-verify-jwt
// It uses the service-role key (injected automatically as SUPABASE_SERVICE_ROLE_KEY)
// to read pin_hash and compares with pgcrypto's crypt() in the database.
//
// Request:  POST { "user_id": "<uuid>", "pin": "1234" }
// Response: { "ok": true } | { "ok": false }  (401 on mismatch)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { user_id, pin } = await req.json()

    if (typeof user_id !== 'string' || !/^\d{4}$/.test(pin ?? '')) {
      return json({ ok: false, error: 'bad_request' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Compare inside Postgres so the hash never leaves the DB.
    const { data, error } = await admin.rpc('verify_user_pin', { p_user_id: user_id, p_pin: pin })
    if (error) return json({ ok: false, error: 'server_error' }, 500)

    return json({ ok: data === true }, data === true ? 200 : 401)
  } catch (_e) {
    return json({ ok: false, error: 'server_error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
