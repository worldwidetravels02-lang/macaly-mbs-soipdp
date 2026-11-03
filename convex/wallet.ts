import { ConvexError, v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { isVerified } from "./verifications"
import { standingOf } from "./accountState"
import { SIGN_IN_BONUS_AED, TIERS } from "./tiers"
import { levelOf } from "./memberLevel"

const MIN_TOP_UP_AED = 1_000
const MAX_TOP_UP_AED = 20_000_000

async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError("You need to be signed in")
  return userId
}

async function memberName(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId)
  const profile = await ctx.db
    .query("memberProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  return profile?.fullName ?? user?.name ?? user?.email ?? "Member"
}

async function ledger(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("walletTransactions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()

  let balanceAed = 0
  let totalTopUpAed = 0
  let totalWithdrawnAed = 0
  let bonusAed = 0
  let profitAed = 0

  for (const row of rows) {
    if (row.status !== "completed") continue
    if (row.type === "withdrawal") {
      balanceAed -= row.amountAed
      totalWithdrawnAed += row.amountAed
      continue
    }
    balanceAed += row.amountAed
    if (row.type === "topup") totalTopUpAed += row.amountAed
    if (row.type === "bonus") bonusAed += row.amountAed
    if (row.type === "profit") profitAed += row.amountAed
  }

  const withdrawals = await ctx.db
    .query("withdrawalRequests")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()

  const pendingWithdrawalAed = withdrawals
    .filter((row) => row.status === "pending")
    .reduce((sum, row) => sum + row.amountAed, 0)

  return {
    balanceAed,
    availableAed: balanceAed - pendingWithdrawalAed,
    pendingWithdrawalAed,
    totalTopUpAed,
    totalWithdrawnAed,
    bonusAed,
    profitAed,
    rows,
    withdrawals,
  }
}

/** Makes sure a wallet and the AED 200 sign-in bonus exist for this member. */
export const ensureWallet = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const existing = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (existing) return null

    const now = Date.now()
    await ctx.db.insert("wallets", { userId, createdAt: now, updatedAt: now })
    await ctx.db.insert("walletTransactions", {
      userId,
      type: "bonus",
      amountAed: SIGN_IN_BONUS_AED,
      status: "completed",
      note: "Sign-in bonus",
      createdAt: now,
    })
    return null
  },
})

/** Wallet balance, membership level and history for the signed-in member. */
export const myWallet = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      balanceAed: v.number(),
      availableAed: v.number(),
      pendingWithdrawalAed: v.number(),
      totalTopUpAed: v.number(),
      totalWithdrawnAed: v.number(),
      bonusAed: v.number(),
      profitAed: v.number(),
      signInBonusAed: v.number(),
      tier: v.object({ level: v.number(), name: v.string() }),
      nextTier: v.union(
        v.null(),
        v.object({ level: v.number(), name: v.string(), minTopUpAed: v.number() }),
      ),
      properties: v.array(
        v.object({
          residence: v.string(),
          totalAed: v.number(),
          deposits: v.number(),
        }),
      ),
      transactions: v.array(
        v.object({
          id: v.id("walletTransactions"),
          type: v.string(),
          amountAed: v.number(),
          status: v.string(),
          note: v.union(v.string(), v.null()),
          createdAt: v.number(),
        }),
      ),
      topUps: v.array(
        v.object({
          id: v.id("topUpRequests"),
          amountAed: v.number(),
          method: v.string(),
          residence: v.union(v.string(), v.null()),
          status: v.string(),
          createdAt: v.number(),
        }),
      ),
      withdrawals: v.array(
        v.object({
          id: v.id("withdrawalRequests"),
          amountAed: v.number(),
          iban: v.string(),
          status: v.string(),
          createdAt: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const totals = await ledger(ctx, userId)
    const memberLevel = await levelOf(ctx, userId)
    const tier = TIERS.find((row) => row.level === memberLevel) ?? TIERS[0]
    const upcoming = TIERS.find((row) => row.level === memberLevel + 1) ?? null

    const topUps = await ctx.db
      .query("topUpRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20)

    const grouped = new Map<string, { totalAed: number; deposits: number }>()
    for (const row of totals.rows) {
      if (row.status !== "completed" || row.type !== "topup" || !row.residence) continue
      const current = grouped.get(row.residence) ?? { totalAed: 0, deposits: 0 }
      grouped.set(row.residence, {
        totalAed: current.totalAed + row.amountAed,
        deposits: current.deposits + 1,
      })
    }
    if (grouped.size === 0) {
      for (const row of topUps) {
        if (!row.residence) continue
        const current = grouped.get(row.residence) ?? { totalAed: 0, deposits: 0 }
        grouped.set(row.residence, {
          totalAed: current.totalAed + row.amountAed,
          deposits: current.deposits + 1,
        })
      }
    }

    const transactions = totals.rows
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30)

    const withdrawals = totals.withdrawals
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20)

    return {
      balanceAed: totals.balanceAed,
      availableAed: totals.availableAed,
      pendingWithdrawalAed: totals.pendingWithdrawalAed,
      totalTopUpAed: totals.totalTopUpAed,
      totalWithdrawnAed: totals.totalWithdrawnAed,
      bonusAed: totals.bonusAed,
      profitAed: totals.profitAed,
      signInBonusAed: SIGN_IN_BONUS_AED,
      properties: Array.from(grouped.entries())
        .map(([residence, value]) => ({ residence, totalAed: value.totalAed, deposits: value.deposits }))
        .sort((a, b) => b.totalAed - a.totalAed),
      tier: { level: tier.level, name: tier.name },
      nextTier: upcoming
        ? { level: upcoming.level, name: upcoming.name, minTopUpAed: upcoming.minTopUpAed }
        : null,
      transactions: transactions.map((row) => ({
        id: row._id,
        type: row.type,
        amountAed: row.amountAed,
        status: row.status,
        note: row.note ?? null,
        createdAt: row.createdAt,
      })),
      topUps: topUps.map((row) => ({
        id: row._id,
        amountAed: row.amountAed,
        method: row.method,
        residence: row.residence ?? null,
        status: row.status,
        createdAt: row.createdAt,
      })),
      withdrawals: withdrawals.map((row) => ({
        id: row._id,
        amountAed: row.amountAed,
        iban: row.iban,
        status: row.status,
        createdAt: row.createdAt,
      })),
    }
  },
})

/** Records an intended top-up. Administration confirms it after funds arrive. */
export const requestTopUp = mutation({
  args: {
    amountAed: v.number(),
    method: v.string(),
    reference: v.optional(v.string()),
    residence: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const amount = Math.round(args.amountAed)
    if (!Number.isFinite(amount) || amount < MIN_TOP_UP_AED) {
      throw new ConvexError(`The minimum top-up is AED ${MIN_TOP_UP_AED.toLocaleString()}`)
    }
    if (amount > MAX_TOP_UP_AED) throw new ConvexError("That amount is above the top-up limit")
    const standing = await standingOf(ctx, userId)
    if (standing === "blocked") throw new ConvexError("Your account is blocked. Contact administration.")
    if (standing === "frozen") throw new ConvexError("Your assets are frozen. Contact administration.")
    if (!(await isVerified(ctx, userId))) {
      throw new ConvexError("Upload your identity document and wait for approval before making a payment")
    }

    await ctx.db.insert("topUpRequests", {
      userId,
      amountAed: amount,
      method: args.method,
      reference: args.reference?.trim() || undefined,
      residence: args.residence?.trim() || undefined,
      status: "pending",
      createdAt: Date.now(),
    })

    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (wallet) await ctx.db.patch(wallet._id, { updatedAt: Date.now() })

    const name = await memberName(ctx, userId)
    await ctx.db.insert("notifications", {
      kind: "topup",
      title: "New top-up request",
      body: `${name} recorded AED ${amount.toLocaleString()} by ${args.method}`,
      userId,
      read: false,
      createdAt: Date.now(),
    })
    return null
  },
})

/** Raises a withdrawal request against the available balance. */
export const requestWithdrawal = mutation({
  args: { amountAed: v.number(), iban: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const amount = Math.round(args.amountAed)
    const iban = args.iban.replace(/\s+/g, "").toUpperCase()

    if (!Number.isFinite(amount) || amount <= 0) throw new ConvexError("Enter the amount to withdraw")
    if (iban.length < 15) throw new ConvexError("Enter a valid IBAN for the payout account")
    const standing = await standingOf(ctx, userId)
    if (standing === "blocked") throw new ConvexError("Your account is blocked. Contact administration.")
    if (standing === "frozen") throw new ConvexError("Your assets are frozen. Contact administration.")
    if (!(await isVerified(ctx, userId))) {
      throw new ConvexError("Upload your identity document and wait for approval before requesting a payment")
    }

    const totals = await ledger(ctx, userId)
    if (amount > totals.balanceAed - totals.pendingWithdrawalAed) {
      throw new ConvexError("That amount is more than your available balance")
    }

    await ctx.db.insert("withdrawalRequests", {
      userId,
      amountAed: amount,
      iban,
      status: "pending",
      createdAt: Date.now(),
    })

    const name = await memberName(ctx, userId)
    await ctx.db.insert("notifications", {
      kind: "withdrawal",
      title: "New withdrawal request",
      body: `${name} requested AED ${amount.toLocaleString()}`,
      userId,
      read: false,
      createdAt: Date.now(),
    })
    return null
  },
})

/** Remembers which investment option the member is interested in. */
export const setInvestmentOption = mutation({
  args: { option: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const option = args.option.trim()
    if (option.length < 2) throw new ConvexError("Choose an investment option")

    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (!wallet) throw new ConvexError("Your wallet is not ready yet")

    await ctx.db.patch(wallet._id, { investmentOption: option, updatedAt: Date.now() })
    return null
  },
})

/** Shared helper for administration screens. */
export async function memberWalletSnapshot(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<{
  balanceAed: number
  totalTopUpAed: number
  totalWithdrawnAed: number
  pendingWithdrawalAed: number
  level: number
  tierName: string
}> {
  const totals = await ledger(ctx, userId)
  const memberLevel = await levelOf(ctx, userId)
  const tier = TIERS.find((row) => row.level === memberLevel) ?? TIERS[0]
  return {
    balanceAed: totals.balanceAed,
    totalTopUpAed: totals.totalTopUpAed,
    totalWithdrawnAed: totals.totalWithdrawnAed,
    pendingWithdrawalAed: totals.pendingWithdrawalAed,
    level: tier.level,
    tierName: tier.name,
  }
}

export const TIER_COUNT = TIERS.length

export type WalletDoc = Doc<"wallets">
