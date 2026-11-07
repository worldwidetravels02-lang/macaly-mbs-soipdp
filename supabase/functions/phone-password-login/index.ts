import { createClient } from "npm:@supabase/supabase-js@2.49.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Invalid login details." }, 405)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("Phone login function is missing Supabase environment configuration.")
    return json({ error: "Login is temporarily unavailable." }, 500)
  }

  let body: { mobile?: unknown; password?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: "Invalid login details." }, 400)
  }

  const mobile = typeof body.mobile === "string" ? body.mobile.trim() : ""
  const password = typeof body.password === "string" ? body.password : ""
  const digits = mobile.replace(/\D/g, "")
  if (digits.length < 7 || digits.length > 15 || password.length < 1 || password.length > 256) {
    return json({ error: "Invalid mobile number or password." }, 400)
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: email, error: lookupError } = await admin.rpc("auth_email_for_mobile", {
      p_mobile: mobile,
    })
    if (lookupError) {
      console.error("Mobile account lookup failed:", lookupError.message)
      return json({ error: "Mobile number or password is incorrect." }, 401)
    }
    if (!email || typeof email !== "string") {
      return json({ error: "Mobile number or password is incorrect." }, 401)
    }

    // Password verification is still performed by Supabase Auth.
    // The resolved email and password are never returned to the browser.
    const tokenResponse = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey },
        body: JSON.stringify({ email, password }),
      },
    )
    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenData.access_token || !tokenData.refresh_token) {
      return json({ error: "Mobile number or password is incorrect." }, 401)
    }

    return json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
    })
  } catch (error) {
    console.error("Mobile login failed:", error)
    return json({ error: "Login is temporarily unavailable." }, 500)
  }
})
