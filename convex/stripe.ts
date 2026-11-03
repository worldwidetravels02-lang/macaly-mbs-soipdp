"use node"

import Stripe from "stripe"
import { v } from "convex/values"
import { ConvexError } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { action, internalAction } from "./_generated/server"
import { internal } from "./_generated/api"

const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf",
  "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
])
const THREE_DECIMAL = new Set(["bhd", "kwd", "omr"])

/** Converts a human readable price into the smallest currency unit. */
export function toUnitAmount(price: number, currency: string): number {
  const code = currency.toLowerCase()
  if (ZERO_DECIMAL.has(code)) return Math.round(price)
  if (THREE_DECIMAL.has(code)) return Math.round(price * 1000)
  return Math.round(price * 100)
}

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new ConvexError("Card payments are not configured yet")
  return new Stripe(key)
}

/**
 * Creates an embedded checkout session for a wallet top-up or a reservation
 * deposit, in AED, USD or INR.
 */
export const createCheckoutSession = action({
  args: {
    kind: v.union(v.literal("topup"), v.literal("deposit")),
    amountAed: v.number(),
    currency: v.string(),
    residence: v.optional(v.string()),
  },
  returns: v.object({ clientSecret: v.string() }),
  handler: async (ctx, args): Promise<{ clientSecret: string }> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError("Sign in to continue")

    const prepared = await ctx.runMutation(internal.payments.prepare, {
      userId,
      kind: args.kind,
      amountAed: args.amountAed,
      currency: args.currency,
      residence: args.residence,
    })

    const stripe = stripeClient()
    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create({
        ui_mode: "embedded_page",
        redirect_on_completion: "never",
        mode: "payment",
        client_reference_id: prepared.paymentId,
        customer_email: prepared.email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: prepared.currency.toLowerCase(),
              unit_amount: toUnitAmount(prepared.amountCharged, prepared.currency),
              product_data: {
                name:
                  args.kind === "topup"
                    ? "Wallet top-up"
                    : `Reservation deposit · ${prepared.residence ?? "Residence"}`,
                description: prepared.description,
              },
            },
          },
        ],
        metadata: {
          paymentId: prepared.paymentId,
          kind: args.kind,
          mode: prepared.mode,
        },
      })
    } catch (error) {
      await ctx.runMutation(internal.payments.markFailed, { paymentId: prepared.paymentId })
      console.error("checkout session failed", error)
      throw new ConvexError("We could not open the payment form. Please try again.")
    }

    if (!session.client_secret) {
      await ctx.runMutation(internal.payments.markFailed, { paymentId: prepared.paymentId })
      throw new ConvexError("We could not open the payment form. Please try again.")
    }

    await ctx.runMutation(internal.payments.attachSession, {
      paymentId: prepared.paymentId,
      sessionId: session.id,
    })

    return { clientSecret: session.client_secret }
  },
})

/** Verifies the provider signature and fulfils the payment. */
export const handleWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
    mode: v.union(v.literal("test"), v.literal("live")),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    const key = process.env.STRIPE_SECRET_KEY
    if (!secret || !key) return { success: false }

    const stripe = new Stripe(key)
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(args.payload, args.signature, secret)
    } catch (error) {
      console.error("webhook signature verification failed", error)
      return { success: false }
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.payment_status === "paid" || session.status === "complete") {
          await ctx.runMutation(internal.payments.markPaid, {
            sessionId: session.id,
            mode: args.mode,
          })
        }
        break
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session
        await ctx.runMutation(internal.payments.markExpired, { sessionId: session.id })
        break
      }
      default:
        break
    }

    return { success: true }
  },
})
