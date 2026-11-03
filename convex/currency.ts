import { v } from "convex/values"
import { ConvexError } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"

/** Currencies a member can pay in. AED is the base currency. */
export const DEFAULT_RATES = [
  { code: "AED", label: "UAE dirham", aedPerUnit: 1 },
  { code: "USD", label: "US dollar", aedPerUnit: 3.6725 },
  { code: "INR", label: "Indian rupee", aedPerUnit: 0.0441 },
]

export const SUPPORTED_CURRENCIES = DEFAULT_RATES.map((rate) => rate.code)

/** Fixed reservation deposit, always quoted in AED and converted for payment. */
export const RESERVATION_DEPOSIT_AED = 50_000

export const MIN_TOP_UP_AED = 1_000
export const MAX_TOP_UP_AED = 20_000_000

/** AED value of one unit of the given currency. */
export async function aedPerUnitFor(ctx: QueryCtx | MutationCtx, code: string): Promise<number> {
  const currency = code.toUpperCase()
  const row = await ctx.db
    .query("fxRates")
    .withIndex("by_code", (q) => q.eq("code", currency))
    .unique()
  const fallback = DEFAULT_RATES.find((rate) => rate.code === currency)
  const value = row?.aedPerUnit ?? fallback?.aedPerUnit
  if (!value || !Number.isFinite(value) || value <= 0) {
    throw new ConvexError("That currency is not available for card payments")
  }
  return value
}

/** Converts an AED amount into the target currency, rounded to two decimals. */
export function convertFromAed(amountAed: number, aedPerUnit: number): number {
  if (aedPerUnit <= 0) throw new ConvexError("The exchange rate is not valid")
  return Math.round((amountAed / aedPerUnit) * 100) / 100
}

export const rates = query({
  args: {},
  returns: v.array(
    v.object({
      code: v.string(),
      label: v.string(),
      aedPerUnit: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("fxRates").collect()
    return DEFAULT_RATES.map((fallback) => {
      const row = rows.find((entry) => entry.code === fallback.code)
      return {
        code: fallback.code,
        label: row?.label ?? fallback.label,
        aedPerUnit: row?.aedPerUnit ?? fallback.aedPerUnit,
      }
    })
  },
})

/** Administration updates the exchange rate used for card payments. */
export const setRate = mutation({
  args: { code: v.string(), aedPerUnit: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError("You need to be signed in")
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (!admin) throw new ConvexError("This area is for administrators only")

    const code = args.code.toUpperCase()
    const fallback = DEFAULT_RATES.find((rate) => rate.code === code)
    if (!fallback) throw new ConvexError("That currency is not supported")
    if (!Number.isFinite(args.aedPerUnit) || args.aedPerUnit <= 0) {
      throw new ConvexError("Enter an exchange rate above zero")
    }

    const existing = await ctx.db
      .query("fxRates")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique()
    const payload = {
      code,
      label: fallback.label,
      aedPerUnit: args.aedPerUnit,
      updatedAt: Date.now(),
      updatedBy: userId,
    }
    if (existing) await ctx.db.patch(existing._id, payload)
    else await ctx.db.insert("fxRates", payload)
    return null
  },
})
