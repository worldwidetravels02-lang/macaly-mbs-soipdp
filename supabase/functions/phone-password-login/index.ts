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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!supabaseUrl || !anonKey) {
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
    // Registration creates the internal Auth email from the local phone digits only.
    // Keep login's lookup identical, while retaining the country code for profile matching.
    const callingCode = mobile.match(/^\+(\d{1,3})/)?.[1] ?? ""
    const localDigits = callingCode
      ? mobile.replace(/^\+\d{1,3}/, "").replace(/\D/g, "")
      : digits
    if (localDigits.length < 7 || localDigits.length > 15) {
      return json({ error: "Invalid mobile number or password." }, 400)
    }
    // The existing owner account can sign in with its assigned administrator
    // phone number. Configure both values as Supabase Edge Function secrets.
    const adminPhone = (Deno.env.get("ADMIN_LOGIN_PHONE") ?? "").replace(/\\D/g, "")
    const adminEmail = (Deno.env.get("ADMIN_LOGIN_EMAIL") ?? "").trim().toLowerCase()
    const isConfiguredAdminPhone =
      adminPhone.length >= 7 && adminPhone === localDigits && adminEmail.includes("@")
    const email = isConfiguredAdminPhone
      ? adminEmail
      : `phone-${localDigits}@accounts.msheireb.invalid`

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

    // Existing customers without an account-request row remain able to sign in.
    // New registrations are blocked until an administrator approves their request.
    const userId = typeof tokenData.user?.id === "string" ? tokenData.user.id : ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!userId || !serviceRoleKey) {
      console.error("Phone login approval check is missing user identity or service-role configuration.")
      return json({ error: "Login is temporarily unavailable." }, 500)
    }
    const approvalResponse = await fetch(
      `${supabaseUrl}/rest/v1/account_requests?user_id=eq.${encodeURIComponent(userId)}&select=status&limit=1`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    )
    if (!approvalResponse.ok) {
      console.error("Could not verify customer account approval status:", approvalResponse.status)
      return json({ error: "Login is temporarily unavailable." }, 500)
    }
    const approvalRows = await approvalResponse.json()
    const approvalStatus = Array.isArray(approvalRows) ? approvalRows[0]?.status : null
    if (approvalStatus === "pending") {
      return json({ error: "Your registration is awaiting administrator approval. Please try again after it is approved." }, 403)
    }
    if (approvalStatus === "rejected") {
      return json({ error: "Your registration request was not approved. Please contact customer support." }, 403)
    }
    const createdAt = Date.parse(String(tokenData.user?.created_at ?? ""))
    const approvalRolloutAt = Date.parse("2026-11-26T11:00:00Z")
    if (!approvalStatus && Number.isFinite(createdAt) && createdAt >= approvalRolloutAt) {
      return json({ error: "Your registration approval request could not be found. Please contact customer support." }, 403)
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
