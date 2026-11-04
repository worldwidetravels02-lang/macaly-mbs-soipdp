import { createClient } from "npm:@supabase/supabase-js@2.49.1"
import Stripe from "npm:stripe@17.7.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })

const ZERO_DECIMAL = new Set(["bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf"])
const THREE_DECIMAL = new Set(["bhd","kwd","omr"])
function toMinorUnits(amount: number, currency: string) {
  const code = currency.toLowerCase()
  if (ZERO_DECIMAL.has(code)) return Math.round(amount)
  if (THREE_DECIMAL.has(code)) return Math.round(amount * 1000)
  return Math.round(amount * 100)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
    if (!supabaseUrl || !anonKey || !serviceKey || !stripeKey) {
      throw new Error("Payment service is not configured")
    }

    const authorization = req.headers.get("Authorization")
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign in to continue" }, 401)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const accessToken = authorization.slice("Bearer ".length)
    const { data: { user }, error: userError } = await userClient.auth.getUser(accessToken)
    if (userError || !user) return json({ error: "Sign in to continue" }, 401)

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const body = await req.json()
    const kind = body?.kind === "deposit" ? "deposit" : body?.kind === "topup" ? "topup" : null
    const amountInput = Number(body?.amountAed)
    const currency = typeof body?.currency === "string" ? body.currency.toUpperCase() : ""
    const residence = typeof body?.residence === "string" ? body.residence.trim() : ""
    if (!kind || !Number.isFinite(amountInput) || amountInput <= 0 || !["AED","USD","INR","OMR","SAR","KWD","BHD","QAR"].includes(currency)) {
      return json({ error: "Invalid checkout details" }, 400)
    }

    const { data: account } = await admin.from("account_states").select("status").eq("user_id", user.id).maybeSingle()
    if (account?.status === "blocked") return json({ error: "Your account is blocked. Contact administration." }, 403)
    if (account?.status === "frozen") return json({ error: "Your assets are frozen. Contact administration." }, 403)

    const { data: verification, error: verificationError } = await admin
      .from("verifications").select("status").eq("user_id", user.id)
      .eq("status", "approved").limit(1).maybeSingle()
    if (verificationError) throw verificationError
    if (!verification) return json({ error: "Upload your identity document and wait for approval before making a payment" }, 403)

    if (kind === "deposit" && !residence) return json({ error: "Choose the residence you want to reserve" }, 400)
    if (kind === "topup" && (amountInput < 50 || amountInput > 1000000)) {
      return json({ error: "Top-ups must be between 50 and 1,000,000 in the selected currency" }, 400)
    }

    let propertyId: string | null = null
    if (kind === "deposit") {
      let { data: property, error: propertyError } = await admin.from("properties")
        .select("id,name,slug").eq("slug", residence).maybeSingle()
      if (propertyError) throw propertyError
      if (!property) {
        const byName = await admin.from("properties").select("id,name,slug").eq("name", residence).maybeSingle()
        if (byName.error) throw byName.error
        property = byName.data
      }
      if (!property) return json({ error: "The selected residence could not be found" }, 400)
      propertyId = property.id
    }

    const { data: rateRow, error: rateError } = await admin.from("fx_rates").select("aed_per_unit").eq("code", currency).maybeSingle()
    if (rateError) throw rateError
    const aedPerUnit = currency === "AED" ? 1 : Number(rateRow?.aed_per_unit)
    if (!Number.isFinite(aedPerUnit) || aedPerUnit <= 0) {
      return json({ error: "The selected currency exchange rate is not configured. Please contact support." }, 400)
    }
    const amountAed = kind === "deposit" ? 200 : Math.round(amountInput * aedPerUnit * 100) / 100
    const amountCharged = kind === "deposit"
      ? Math.round((amountAed / aedPerUnit) * 1000) / 1000
      : Math.round(amountInput * 1000) / 1000
    const mode = Deno.env.get("STRIPE_MODE") === "live" ? "live" : "test"

    const { data: payment, error: insertError } = await admin.from("payments").insert({
      user_id: user.id, kind, amount: amountAed, amount_charged: amountCharged,
      currency, aed_per_unit: aedPerUnit, property_id: propertyId,
      status: "pending", mode, provider: "stripe",
    }).select("id").single()
    if (insertError) throw insertError

    const stripe = new Stripe(stripeKey)
    try {
      const session = await stripe.checkout.sessions.create({
        ui_mode: "embedded",
        redirect_on_completion: "never",
        mode: "payment",
        client_reference_id: payment.id,
        customer_email: user.email,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: toMinorUnits(amountCharged, currency),
            product_data: {
              name: kind === "topup" ? "Wallet top-up" : `Reservation deposit · ${residence}`,
              description: kind === "topup" ? `Wallet top-up · AED ${amountAed.toLocaleString()}` : `Reservation deposit · ${residence}`,
            },
          },
        }],
        metadata: { paymentId: payment.id, kind, mode },
      })
      if (!session.client_secret) throw new Error("Stripe did not return a checkout client secret")
      const { error: updateError } = await admin.from("payments")
        .update({ provider_session_id: session.id }).eq("id", payment.id)
      if (updateError) throw updateError
      return json({ clientSecret: session.client_secret })
    } catch (error) {
      await admin.from("payments").update({ status: "expired" }).eq("id", payment.id)
      throw error
    }
  } catch (error) {
    console.error("create-checkout-session:", error)
    return json({ error: error instanceof Error ? error.message : "Could not start payment" }, 400)
  }
})
