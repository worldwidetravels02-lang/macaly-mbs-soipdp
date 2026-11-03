import { ConvexError, v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"

export type Rank = {
  code: string
  level: number
  name: string
  minAed: number
  profitPercent: number
  commissionPercent: number
  /** How many residence projects this level unlocks. */
  propertyAllowance: number
}

/** Investment ladder. Level 1 to 5, then the three project tiers. */
export const RANKS: Rank[] = [
  { code: "level-1", level: 1, name: "Level 1", minAed: 50_000, profitPercent: 5, commissionPercent: 0.4, propertyAllowance: 20 },
  { code: "level-2", level: 2, name: "Level 2", minAed: 150_000, profitPercent: 6, commissionPercent: 0.5, propertyAllowance: 40 },
  { code: "level-3", level: 3, name: "Level 3", minAed: 400_000, profitPercent: 7, commissionPercent: 0.7, propertyAllowance: 60 },
  { code: "senior", level: 4, name: "Senior Projects", minAed: 1_000_000, profitPercent: 8, commissionPercent: 0.9, propertyAllowance: 80 },
  { code: "premium", level: 5, name: "Premium Projects", minAed: 5_000_000, profitPercent: 10, commissionPercent: 1.2, propertyAllowance: 100 },
  { code: "exclusive", level: 6, name: "Exclusive Projects", minAed: 10_000_000, profitPercent: 12, commissionPercent: 1, propertyAllowance: 120 },
]

export function rankByCode(code: string): Rank {
  return RANKS.find((rank) => rank.code === code) ?? RANKS[0]
}

/** Highest rank the invested total qualifies for. */
export function rankForTotal(totalAed: number): Rank {
  let current = RANKS[0]
  for (const rank of RANKS) {
    if (totalAed >= rank.minAed) current = rank
  }
  return current
}

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

async function memberLabel(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId)
  const profile = await ctx.db
    .query("memberProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  return {
    name: profile?.fullName?.trim() || user?.name?.trim() || user?.email || "Member",
    email: user?.email ?? "",
    mobile: profile?.mobile ?? "",
  }
}

async function investedTotal(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("investmentRequests")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()
  return rows
    .filter((row) => row.status === "funded")
    .reduce((sum, row) => sum + row.amountAed, 0)
}

const stripAllowance = (rank: Rank) => {
  const { propertyAllowance: _allowance, ...rest } = rank
  return { ...rest }
}

const rankValidator = v.object({
  code: v.string(),
  level: v.number(),
  name: v.string(),
  minAed: v.number(),
  profitPercent: v.number(),
  commissionPercent: v.number(),
})

const statusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("funded"),
)

/** The public investment ladder. */
export const ranks = query({
  args: {},
  returns: v.array(rankValidator),
  handler: async () => RANKS.map(({ propertyAllowance: _allowance, ...rank }) => ({ ...rank })),
})

/** The member's current level and how far the next one is. */
export const myLevel = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      totalInvestedAed: v.number(),
      rank: rankValidator,
      next: v.union(v.null(), rankValidator),
      toNextAed: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const total = await investedTotal(ctx, userId)
    const rank = rankForTotal(total)
    const next = RANKS.find((item) => item.minAed > total) ?? null
    return {
      totalInvestedAed: total,
      rank: stripAllowance(rank),
      next: next ? stripAllowance(next) : null,
      toNextAed: next ? Math.max(0, next.minAed - total) : 0,
    }
  },
})

/** A member asks to invest at a chosen level. */
export const request = mutation({
  args: {
    residence: v.string(),
    rankCode: v.string(),
    amountAed: v.number(),
    note: v.optional(v.string()),
  },
  returns: v.id("investmentRequests"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const rank = RANKS.find((item) => item.code === args.rankCode)
    if (!rank) throw new ConvexError("Choose an investment level")
    const amount = Math.round(args.amountAed)
    if (!Number.isFinite(amount) || amount < rank.minAed) {
      throw new ConvexError(`${rank.name} starts at AED ${rank.minAed.toLocaleString("en-AE")}`)
    }
    if (amount > 50_000_000) throw new ConvexError("That amount is above the investment limit")
    const residence = args.residence.trim()
    if (!residence) throw new ConvexError("Choose a residence")

    const existing = await ctx.db
      .query("investmentRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    if (existing.some((row) => row.status === "pending" && row.residence === residence)) {
      throw new ConvexError("You already have an investment waiting for approval here")
    }

    const id = await ctx.db.insert("investmentRequests", {
      userId,
      residence,
      rankCode: rank.code,
      amountAed: amount,
      note: args.note?.trim() || undefined,
      status: "pending",
      createdAt: Date.now(),
    })

    await ctx.db.insert("notifications", {
      kind: "investment",
      title: "New investment request",
      body: `${rank.name} · ${residence} · AED ${amount.toLocaleString("en-AE")} waiting for approval`,
      userId,
      createdAt: Date.now(),
      read: false,
    })

    return id
  },
})

/** The member's own investment requests, newest first. */
export const myInvestments = query({
  args: {},
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        id: v.id("investmentRequests"),
        residence: v.string(),
        rankCode: v.string(),
        rankName: v.string(),
        amountAed: v.number(),
        profitAed: v.union(v.number(), v.null()),
        commissionAed: v.union(v.number(), v.null()),
        status: statusValidator,
        note: v.union(v.string(), v.null()),
        createdAt: v.number(),
        fundedAt: v.union(v.number(), v.null()),
      }),
    ),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const rows = await ctx.db
      .query("investmentRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((row) => {
        const rank = rankByCode(row.rankCode)
        return {
          id: row._id,
          residence: row.residence,
          rankCode: rank.code,
          rankName: rank.name,
          amountAed: row.amountAed,
          profitAed: row.profitAed ?? null,
          commissionAed: row.commissionAed ?? null,
          status: row.status,
          note: row.note ?? null,
          createdAt: row.createdAt,
          fundedAt: row.fundedAt ?? null,
        }
      })
  },
})

/** Administration queue with member details and levels. */
export const adminRequests = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("investmentRequests"),
      userId: v.id("users"),
      name: v.string(),
      email: v.string(),
      mobile: v.string(),
      residence: v.string(),
      rankCode: v.string(),
      rankName: v.string(),
      amountAed: v.number(),
      profitAed: v.union(v.number(), v.null()),
      commissionAed: v.union(v.number(), v.null()),
      memberLevel: v.number(),
      memberRankName: v.string(),
      note: v.union(v.string(), v.null()),
      status: statusValidator,
      createdAt: v.number(),
      reviewedAt: v.union(v.number(), v.null()),
      fundedAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const rows = await ctx.db.query("investmentRequests").order("desc").take(80)
    return await Promise.all(
      rows.map(async (row) => {
        const member = await memberLabel(ctx, row.userId)
        const rank = rankByCode(row.rankCode)
        const memberRank = rankForTotal(await investedTotal(ctx, row.userId))
        return {
          id: row._id,
          userId: row.userId,
          name: member.name,
          email: member.email,
          mobile: member.mobile,
          residence: row.residence,
          rankCode: rank.code,
          rankName: rank.name,
          amountAed: row.amountAed,
          profitAed: row.profitAed ?? null,
          commissionAed: row.commissionAed ?? null,
          memberLevel: memberRank.level,
          memberRankName: memberRank.name,
          note: row.note ?? null,
          status: row.status,
          createdAt: row.createdAt,
          reviewedAt: row.reviewedAt ?? null,
          fundedAt: row.fundedAt ?? null,
        }
      }),
    )
  },
})

/** Administration approves or rejects a pending investment request. */
export const decide = mutation({
  args: {
    id: v.id("investmentRequests"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx)
    const row = await ctx.db.get(args.id)
    if (!row) throw new ConvexError("That request no longer exists")
    if (row.status !== "pending") throw new ConvexError("That request is already decided")

    await ctx.db.patch(row._id, {
      status: args.decision === "approve" ? "approved" : "rejected",
      reviewedAt: Date.now(),
      reviewedBy: adminId,
    })
    return null
  },
})

/**
 * Administration pays an approved investment into the member wallet together
 * with the level profit and commission for that level.
 */
export const fund = mutation({
  args: { id: v.id("investmentRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx)
    const row = await ctx.db.get(args.id)
    if (!row) throw new ConvexError("That request no longer exists")
    if (row.status !== "approved") {
      throw new ConvexError("Approve the investment before paying the wallet")
    }

    const plan = await ctx.db
      .query("membershipPlans")
      .withIndex("by_code", (q) => q.eq("code", row.rankCode))
      .unique()
    const rank = plan
      ? {
          code: plan.code,
          level: plan.level,
          name: plan.name,
          minAed: plan.minAed,
          profitPercent: plan.profitPercent,
          commissionPercent: plan.commissionPercent,
        }
      : rankByCode(row.rankCode)
    const profitAed = Math.round((row.amountAed * rank.profitPercent) / 100)
    const commissionAed = Math.round((row.amountAed * rank.commissionPercent) / 100)
    const now = Date.now()

    const credit = async (amountAed: number, type: "topup" | "bonus", note: string) => {
      await ctx.db.insert("walletTransactions", {
        userId: row.userId,
        type,
        amountAed,
        status: "completed",
        note,
        residence: row.residence,
        createdAt: now,
        createdBy: adminId,
      })
    }

    await credit(row.amountAed, "topup", `Investment approved · ${row.residence}`)
    await credit(profitAed, "bonus", `${rank.name} profit · ${rank.profitPercent}%`)
    await credit(commissionAed, "bonus", `${rank.name} commission · ${rank.commissionPercent}%`)

    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", row.userId))
      .unique()
    if (wallet) {
      await ctx.db.patch(wallet._id, { updatedAt: now })
    } else {
      await ctx.db.insert("wallets", { userId: row.userId, createdAt: now, updatedAt: now })
    }

    await ctx.db.patch(row._id, {
      status: "funded",
      fundedAt: now,
      profitAed,
      commissionAed,
    })
    return null
  },
})
