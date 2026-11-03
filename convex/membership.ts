import { ConvexError, v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { RANKS } from "./investments"

const MAX_ADJUSTMENT_AED = 50_000_000

async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError("You need to be signed in")
  return userId
}

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await requireUserId(ctx)
  const row = await ctx.db
    .query("admins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  if (!row) throw new ConvexError("This area is for administrators only")
  return userId
}

type PlanRow = {
  code: string
  level: number
  name: string
  minAed: number
  profitPercent: number
  commissionPercent: number
  active: boolean
}

/**
 * Every level is always listed. Levels without a saved row use the built-in
 * defaults, so administration can edit one level without hiding the others.
 */
async function storedPlans(ctx: QueryCtx | MutationCtx): Promise<PlanRow[]> {
  const rows = await ctx.db.query("membershipPlans").collect()
  const byCode = new Map(rows.map((row) => [row.code, row]))
  return RANKS.map((rank) => {
    const row = byCode.get(rank.code)
    return {
      code: rank.code,
      level: rank.level,
      name: rank.name,
      minAed: row?.minAed ?? rank.minAed,
      profitPercent: row?.profitPercent ?? rank.profitPercent,
      commissionPercent: row?.commissionPercent ?? rank.commissionPercent,
      active: row?.active ?? true,
    }
  })
}

const planValidator = v.object({
  code: v.string(),
  level: v.number(),
  name: v.string(),
  minAed: v.number(),
  profitPercent: v.number(),
  commissionPercent: v.number(),
  active: v.boolean(),
})

/** Active membership plans shown to members. */
export const plans = query({
  args: {},
  returns: v.array(planValidator),
  handler: async (ctx) => {
    const rows = await storedPlans(ctx)
    return rows.filter((row) => row.active)
  },
})

/** Administration view of plans plus commission paid per plan. */
export const adminPlans = query({
  args: {},
  returns: v.object({
    plans: v.array(planValidator),
    commissions: v.array(
      v.object({
        code: v.string(),
        name: v.string(),
        count: v.number(),
        paidAed: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const rows = await storedPlans(ctx)
    const bonuses = await ctx.db
      .query("walletTransactions")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect()

    const commissions = rows.map((plan) => {
      const matching = bonuses.filter(
        (row) =>
          row.type === "bonus" &&
          typeof row.note === "string" &&
          row.note.startsWith(plan.name) &&
          row.note.includes("commission"),
      )
      return {
        code: plan.code,
        name: plan.name,
        count: matching.length,
        paidAed: matching.reduce((sum, row) => sum + row.amountAed, 0),
      }
    })

    return { plans: rows, commissions }
  },
})

/** Administration saves a plan's limits and percentages. */
export const savePlan = mutation({
  args: {
    code: v.string(),
    minAed: v.number(),
    profitPercent: v.number(),
    commissionPercent: v.number(),
    active: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const base = RANKS.find((rank) => rank.code === args.code)
    if (!base) throw new ConvexError("Unknown membership plan")
    const minAed = Math.round(args.minAed)
    if (!Number.isFinite(minAed) || minAed < 0) throw new ConvexError("Enter a valid minimum")
    if (args.profitPercent < 0 || args.profitPercent > 100) {
      throw new ConvexError("Profit must be between 0 and 100")
    }
    if (args.commissionPercent < 0 || args.commissionPercent > 100) {
      throw new ConvexError("Commission must be between 0 and 100")
    }

    const existing = await ctx.db
      .query("membershipPlans")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique()
    const values = {
      code: base.code,
      level: base.level,
      name: base.name,
      minAed,
      profitPercent: args.profitPercent,
      commissionPercent: args.commissionPercent,
      active: args.active,
      updatedAt: Date.now(),
    }
    if (existing) {
      await ctx.db.patch(existing._id, values)
    } else {
      await ctx.db.insert("membershipPlans", values)
    }
    return null
  },
})

/** Administration sets the monthly profit percentage for one membership level. */
export const setLevelProfit = mutation({
  args: {
    level: v.number(),
    profitPercent: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const base = RANKS.find((rank) => rank.level === args.level)
    if (!base) throw new ConvexError("Unknown membership level")
    if (!Number.isFinite(args.profitPercent) || args.profitPercent < 0 || args.profitPercent > 100) {
      throw new ConvexError("Profit must be between 0 and 100")
    }
    const profitPercent = Math.round(args.profitPercent * 100) / 100
    const existing = await ctx.db
      .query("membershipPlans")
      .withIndex("by_code", (q) => q.eq("code", base.code))
      .unique()
    const values = {
      code: base.code,
      level: base.level,
      name: base.name,
      minAed: existing?.minAed ?? base.minAed,
      profitPercent,
      commissionPercent: existing?.commissionPercent ?? base.commissionPercent,
      active: existing?.active ?? true,
      updatedAt: Date.now(),
    }
    if (existing) {
      await ctx.db.patch(existing._id, values)
    } else {
      await ctx.db.insert("membershipPlans", values)
    }
    return null
  },
})

/**
 * Administration adjusts a member wallet balance. Credit adds funds, debit
 * removes them. Members cannot change their own balance.
 */
export const adjustBalance = mutation({
  args: {
    userId: v.id("users"),
    direction: v.union(v.literal("credit"), v.literal("debit")),
    amountAed: v.number(),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx)
    const amount = Math.round(args.amountAed)
    if (!Number.isFinite(amount) || amount <= 0) throw new ConvexError("Enter an amount")
    if (amount > MAX_ADJUSTMENT_AED) throw new ConvexError("That amount is above the limit")

    const user = await ctx.db.get(args.userId)
    if (!user) throw new ConvexError("That member no longer exists")

    const now = Date.now()
    const reason = args.note?.trim()
    await ctx.db.insert("walletTransactions", {
      userId: args.userId,
      type: args.direction === "credit" ? "topup" : "withdrawal",
      amountAed: amount,
      status: "completed",
      note:
        args.direction === "credit"
          ? `Admin credit${reason ? ` · ${reason}` : ""}`
          : `Admin debit${reason ? ` · ${reason}` : ""}`,
      createdAt: now,
      createdBy: adminId,
    })

    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique()
    if (wallet) {
      await ctx.db.patch(wallet._id, { updatedAt: now })
    } else {
      await ctx.db.insert("wallets", { userId: args.userId, createdAt: now, updatedAt: now })
    }
    return null
  },
})
