import { createClient } from "npm:@supabase/supabase-js@2.49.1"
import Stripe from "npm:stripe@17.7.0"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const ZERO_DECIMAL = new Set(["bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf"])
const THREE_DECIMAL = new Set(["bhd","kwd","omr"])
function toMinorUnits(amount: number, currency: string) {
  const code = currency.toLowerCase()
  if (ZERO_DECIMAL.has(code)) return Math.round(amount)
  if (THREE_DECIMAL.has(code)) return Math.round(amount * 1000)
  return Math.round(amount * 100)
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")
  const url = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!stripeKey || !webhookSecret || !url || !serviceKey) return json({ error: "Webhook is not configured" }, 500)

  const signature = req.headers.get("stripe-signature")
  if (!signature) return json({ error: "Missing Stripe signature" }, 400)
  const payload = await req.text()
  const stripe = new Stripe(stripeKey)
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload, signature, webhookSecret, undefined, Stripe.createSubtleCryptoProvider(),
    )
  } catch (error) {
    console.error("Stripe signature verification failed:", error)
    return json({ error: "Invalid Stripe signature" }, 400)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session
    const paymentId = session.metadata?.paymentId
    if (!paymentId) return json({ error: "Missing payment reference" }, 400)

    const { data: payment, error: paymentError } = await admin.from("payments")
      .select("id,amount,amount_charged,currency,provider_session_id,status")
      .eq("id", paymentId).maybeSingle()
    if (paymentError) throw paymentError
    if (!payment || payment.provider_session_id !== session.id) return json({ error: "Payment session mismatch" }, 400)

    const paid = event.type === "checkout.session.completed" && session.payment_status === "paid"
    if (paid) {
      const expected = toMinorUnits(Number(payment.amount_charged), payment.currency)
      if (session.amount_total !== expected || session.currency?.toUpperCase() !== payment.currency.toUpperCase()) {
        return json({ error: "Paid amount does not match the payment record" }, 400)
      }
    }

    const { error: finalizeError } = await admin.rpc("finalize_stripe_payment", {
      p_session_id: session.id,
      p_paid: paid,
    })
    if (finalizeError) {
      console.error("Could not finalize Stripe payment:", finalizeError)
      return json({ error: "Payment finalization failed" }, 500)
    }
  }
  return json({ received: true })
})
