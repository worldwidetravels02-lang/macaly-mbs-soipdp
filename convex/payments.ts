import { v } from "convex/values"
import { ConvexError } from "convex/values"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { internalMutation, mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import {
  MAX_TOP_UP_AED,
  MIN_TOP_UP_AED,
  RESERVATION_DEPOSIT_AED,
  aedPerUnitFor,
  convertFromAed,
} from "./currency"
import { standingOf } from "./accountState"
import { isVerified } from "./verifications"

const paymentKind = v.union(v.literal("topup"), v.literal("deposit"))
const paymentStatus = v.union(v.literal("pending"), v.literal("paid"), v.literal("expired"))
const modeValidator = v.union(v.literal("test"), v.literal("live"))

function currentMode(): "test" | "live" {
  return (process.env.VITE_STRIPE_MODE ?? "test") === "live" ? "live" : "test"
}

async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError("Sign in to continue")
  return userId
}

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await requireUserId(ctx)
  const admin = await ctx.db
    .query("admins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  if (!admin) throw new ConvexError("This area is for administrators only")
  return userId
}

async function memberName(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const profile = await ctx.db
    .query("memberProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  const user = await ctx.db.get(userId)
  return profile?.fullName ?? user?.name ?? user?.email ?? "Member"
}

/**
 * Validates a card payment and records it as pending. Called by the checkout
 * action before a payment session is created.
 */
export const prepare = internalMutation({
  args: {
    userId: v.id("users"),
    kind: paymentKind,
    amountAed: v.number(),
    currency: v.string(),
    residence: v.optional(v.string()),
  },
  returns: v.object({
    paymentId: v.id("payments"),
    amountAed: v.number(),
    amountCharged: v.number(),
    currency: v.string(),
    mode: modeValidator,
    email: v.optional(v.string()),
    name: v.string(),
    residence: v.optional(v.string()),
    description: v.string(),
  }),
  handler: async (ctx, args) => {
    const standing = await standingOf(ctx, args.userId)
    if (standing === "blocked") throw new ConvexError("Your account is blocked. Contact administration.")
    if (standing === "frozen") throw new ConvexError("Your assets are frozen. Contact administration.")
    if (!(await isVerified(ctx, args.userId))) {
      throw new ConvexError("Upload your identity document and wait for approval before making a payment")
    }

    const currency = args.currency.toUpperCase()
    const amountAed =
      args.kind === "deposit" ? RESERVATION_DEPOSIT_AED : Math.round(args.amountAed)
    if (args.kind === "topup") {
      if (!Number.isFinite(amountAed) || amountAed < MIN_TOP_UP_AED) {
        throw new ConvexError(`The minimum top-up is AED ${MIN_TOP_UP_AED.toLocaleString()}`)
      }
      if (amountAed > MAX_TOP_UP_AED) {
        throw new ConvexError("That amount is above the top-up limit")
      }
    }
    if (args.kind === "deposit" && !args.residence?.trim()) {
      throw new ConvexError("Choose the residence you want to reserve")
    }

    const aedPerUnit = await aedPerUnitFor(ctx, currency)
    const amountCharged = convertFromAed(amountAed, aedPerUnit)
    const residence = args.residence?.trim() || undefined
    const mode = currentMode()

    const paymentId = await ctx.db.insert("payments", {
      userId: args.userId,
      kind: args.kind,
      amountAed,
      amountCharged,
      currency,
      aedPerUnit,
      residence,
      status: "pending",
      createdAt: Date.now(),
      mode,
    })

    const user = await ctx.db.get(args.userId)
    const name = await memberName(ctx, args.userId)
    const description =
      args.kind === "topup"
        ? `Wallet top-up · AED ${amountAed.toLocaleString()}`
        : `Reservation deposit · ${residence}`

    return {
      paymentId,
      amountAed,
      amountCharged,
      currency,
      mode,
      email: user?.email ?? undefined,
      name,
      residence,
      description,
    }
  },
})

/** Stores the payment session identifier returned by the provider. */
export const attachSession = internalMutation({
  args: { paymentId: v.id("payments"), sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.paymentId, { sessionId: args.sessionId })
    return null
  },
})

/** Credits the wallet or records the reservation once the provider confirms payment. */
export const markPaid = internalMutation({
  args: { sessionId: v.string(), mode: modeValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique()
    if (!payment) return null
    if (payment.status === "paid") return null

    const now = Date.now()
    await ctx.db.patch(payment._id, { status: "paid", paidAt: now, mode: args.mode })

    if (payment.kind === "topup") {
      await ctx.db.insert("walletTransactions", {
        userId: payment.userId,
        type: "topup",
        amountAed: payment.amountAed,
        status: "completed",
        note: `Card payment · ${payment.currency} ${payment.amountCharged.toLocaleString()}`,
        residence: payment.residence,
        createdAt: now,
      })

      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", payment.userId))
        .unique()
      if (wallet) await ctx.db.patch(wallet._id, { updatedAt: now })
      else await ctx.db.insert("wallets", { userId: payment.userId, createdAt: now, updatedAt: now })
    } else {
      await ctx.db.insert("reservationDeposits", {
        userId: payment.userId,
        residence: payment.residence ?? "Residence",
        amountAed: payment.amountAed,
        amountCharged: payment.amountCharged,
        currency: payment.currency,
        paymentId: payment._id,
        createdAt: now,
        mode: args.mode,
      })
    }

    const name = await memberName(ctx, payment.userId)
    await ctx.db.insert("notifications", {
      kind: payment.kind === "topup" ? "topup" : "deposit",
      title: payment.kind === "topup" ? "Card top-up received" : "Reservation deposit received",
      body: `${name} paid ${payment.currency} ${payment.amountCharged.toLocaleString()} (AED ${payment.amountAed.toLocaleString()})`,
      userId: payment.userId,
      read: false,
      createdAt: now,
    })
    return null
  },
})

/** Drops a payment row when the provider refuses to open a session. */
export const markFailed = internalMutation({
  args: { paymentId: v.id("payments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId)
    if (!payment || payment.status !== "pending") return null
    await ctx.db.patch(payment._id, { status: "expired" })
    return null
  },
})

/** Marks an abandoned checkout as expired. */
export const markExpired = internalMutation({
  args: { sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique()
    if (!payment || payment.status !== "pending") return null
    await ctx.db.patch(payment._id, { status: "expired" })
    return null
  },
})

/** Card payments made by the signed-in member. */
export const myPayments = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("payments"),
      kind: paymentKind,
      amountAed: v.number(),
      amountCharged: v.number(),
      currency: v.string(),
      residence: v.union(v.string(), v.null()),
      status: paymentStatus,
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const rows = await ctx.db
      .query("payments")
      .withIndex("by_user_and_mode", (q) => q.eq("userId", userId).eq("mode", currentMode()))
      .order("desc")
      .take(25)
    return rows.map((row) => ({
      id: row._id,
      kind: row.kind,
      amountAed: row.amountAed,
      amountCharged: row.amountCharged,
      currency: row.currency,
      residence: row.residence ?? null,
      status: row.status,
      createdAt: row.createdAt,
    }))
  },
})

/** Reservation deposits paid by the signed-in member. */
export const myDeposits = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("reservationDeposits"),
      residence: v.string(),
      amountAed: v.number(),
      amountCharged: v.number(),
      currency: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const rows = await ctx.db
      .query("reservationDeposits")
      .withIndex("by_user_and_mode", (q) => q.eq("userId", userId).eq("mode", currentMode()))
      .order("desc")
      .take(25)
    return rows.map((row) => ({
      id: row._id,
      residence: row.residence,
      amountAed: row.amountAed,
      amountCharged: row.amountCharged,
      currency: row.currency,
      createdAt: row.createdAt,
    }))
  },
})

/** Confirmed card totals per currency for administration. */
export const adminSummary = query({
  args: {},
  returns: v.array(
    v.object({
      code: v.string(),
      topupCount: v.number(),
      topupCharged: v.number(),
      depositCount: v.number(),
      depositCharged: v.number(),
      totalCharged: v.number(),
      totalAed: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const rows = await ctx.db
      .query("payments")
      .withIndex("by_mode", (q) => q.eq("mode", currentMode()))
      .collect()

    const totals = new Map<
      string,
      {
        code: string
        topupCount: number
        topupCharged: number
        depositCount: number
        depositCharged: number
        totalCharged: number
        totalAed: number
      }
    >()

    for (const row of rows) {
      if (row.status !== "paid") continue
      const entry = totals.get(row.currency) ?? {
        code: row.currency,
        topupCount: 0,
        topupCharged: 0,
        depositCount: 0,
        depositCharged: 0,
        totalCharged: 0,
        totalAed: 0,
      }
      if (row.kind === "topup") {
        entry.topupCount += 1
        entry.topupCharged += row.amountCharged
      } else {
        entry.depositCount += 1
        entry.depositCharged += row.amountCharged
      }
      entry.totalCharged += row.amountCharged
      entry.totalAed += row.amountAed
      totals.set(row.currency, entry)
    }

    return [...totals.values()].sort((a, b) =>
      a.code === "AED" ? -1 : b.code === "AED" ? 1 : a.code.localeCompare(b.code),
    )
  },
})

/** Administration view of card payments in the current mode. */
export const adminPayments = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("payments"),
      name: v.string(),
      email: v.string(),
      kind: paymentKind,
      amountAed: v.number(),
      amountCharged: v.number(),
      currency: v.string(),
      residence: v.union(v.string(), v.null()),
      status: paymentStatus,
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const rows = await ctx.db
      .query("payments")
      .withIndex("by_mode", (q) => q.eq("mode", currentMode()))
      .order("desc")
      .take(40)
    return await Promise.all(
      rows.map(async (row) => {
        const user = await ctx.db.get(row.userId)
        return {
          id: row._id,
          name: await memberName(ctx, row.userId),
          email: user?.email ?? "",
          kind: row.kind,
          amountAed: row.amountAed,
          amountCharged: row.amountCharged,
          currency: row.currency,
          residence: row.residence ?? null,
          status: row.status,
          createdAt: row.createdAt,
        }
      }),
    )
  },
})

/** Clears a pending card payment, used when a member abandons checkout. */
export const cancelPending = mutation({
  args: { paymentId: v.id("payments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const payment = await ctx.db.get(args.paymentId)
    if (!payment || payment.userId !== userId || payment.status !== "pending") return null
    await ctx.db.patch(payment._id, { status: "expired" })
    return null
  },
})
