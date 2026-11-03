import { ConvexError, v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { internalMutation, mutation, query } from "./_generated/server"
import { RANKS } from "./investments"
import { TIERS } from "./tiers"
import { levelOf } from "./memberLevel"

type PlanRow = {
  code: string
  level: number
  name: string
  profitPercent: number
  active: boolean
}

const round2 = (value: number) => Math.round(value * 100) / 100

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

/** Month key in UTC, for example 2026-10. */
export function periodKeyOf(timestamp: number): string {
  const date = new Date(timestamp)
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0")
  return `${date.getUTCFullYear()}-${month}`
}

/** The most recently completed month, which is what an automatic run pays. */
export function previousPeriodKey(now: number): string {
  const date = new Date(now)
  const previous = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1))
  return periodKeyOf(previous.getTime())
}

export function isValidPeriodKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

async function storedPlans(ctx: QueryCtx | MutationCtx): Promise<PlanRow[]> {
  const rows = await ctx.db.query("membershipPlans").collect()
  if (rows.length === 0) {
    return RANKS.map((rank) => ({
      code: rank.code,
      level: rank.level,
      name: rank.name,
      profitPercent: rank.profitPercent,
      active: true,
    }))
  }
  return rows
    .map((row) => ({
      code: row.code,
      level: row.level,
      name: row.name,
      profitPercent: row.profitPercent,
      active: row.active,
    }))
    .sort((a, b) => a.level - b.level)
}

function planForLevel(plans: PlanRow[], level: number): PlanRow {
  const byLevel = plans.find((plan) => plan.level === level)
  if (byLevel) return byLevel
  const rank = RANKS.find((item) => item.level === level) ?? RANKS[0]
  return {
    code: rank.code,
    level: rank.level,
    name: rank.name,
    profitPercent: rank.profitPercent,
    active: true,
  }
}

/** Profit base: approved wallet deposits plus funded investments. */
async function profitBasis(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const transactions = await ctx.db
    .query("walletTransactions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()
  const topUpsAed = transactions
    .filter((row) => row.status === "completed" && row.type === "topup")
    .reduce((sum, row) => sum + row.amountAed, 0)

  const investments = await ctx.db
    .query("investmentRequests")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()
  const investedAed = investments
    .filter((row) => row.status === "funded")
    .reduce((sum, row) => sum + row.amountAed, 0)

  return { topUpsAed, investedAed, basisAed: round2(topUpsAed + investedAed) }
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
  }
}

/** Credits one monthly profit payout per member for the given month. */
async function runPayouts(
  ctx: MutationCtx,
  periodKey: string,
  createdBy?: Id<"users">,
) {
  if (!isValidPeriodKey(periodKey)) {
    throw new ConvexError("Use a month in the format YYYY-MM")
  }
  const plans = await storedPlans(ctx)
  const wallets = await ctx.db.query("wallets").collect()
  const investments = await ctx.db.query("investmentRequests").collect()
  const userIds = new Set<Id<"users">>()
  for (const wallet of wallets) userIds.add(wallet.userId)
  for (const row of investments) {
    if (row.status === "funded") userIds.add(row.userId)
  }

  const now = Date.now()
  let credited = 0
  let skipped = 0
  let totalAed = 0

  for (const userId of userIds) {
    const basis = await profitBasis(ctx, userId)
    if (basis.basisAed <= 0) {
      skipped += 1
      continue
    }

    const existing = await ctx.db
      .query("profitPayouts")
      .withIndex("by_user_and_period", (q) =>
        q.eq("userId", userId).eq("periodKey", periodKey),
      )
      .unique()
    if (existing) {
      skipped += 1
      continue
    }

    const level = await levelOf(ctx, userId)
    const plan = planForLevel(plans, level)
    const amountAed = round2((basis.basisAed * plan.profitPercent) / 100)
    if (amountAed <= 0) {
      skipped += 1
      continue
    }

    const note = `Monthly profit ${periodKey} · ${plan.name} ${plan.profitPercent}%`
    const transactionId = await ctx.db.insert("walletTransactions", {
      userId,
      type: "profit",
      amountAed,
      status: "completed",
      note,
      createdAt: now,
      createdBy,
    })
    await ctx.db.insert("profitPayouts", {
      userId,
      periodKey,
      planCode: plan.code,
      planName: plan.name,
      level: plan.level,
      percent: plan.profitPercent,
      basisAed: basis.basisAed,
      amountAed,
      note,
      createdAt: now,
      createdBy,
      walletTransactionId: transactionId,
    })
    credited += 1
    totalAed = round2(totalAed + amountAed)
  }

  return { periodKey, credited, skipped, totalAed }
}

/** Administration trigger for a monthly profit run. */
export const runMonthlyPayouts = mutation({
  args: { periodKey: v.optional(v.string()) },
  returns: v.object({
    periodKey: v.string(),
    credited: v.number(),
    skipped: v.number(),
    totalAed: v.number(),
  }),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx)
    const periodKey = args.periodKey?.trim() || previousPeriodKey(Date.now())
    return await runPayouts(ctx, periodKey, adminId)
  },
})

/** Automatic monthly run, executed by the cron job on the first of each month. */
export const runScheduled = internalMutation({
  args: {},
  returns: v.object({
    periodKey: v.string(),
    credited: v.number(),
    skipped: v.number(),
    totalAed: v.number(),
  }),
  handler: async (ctx) => {
    const periodKey = previousPeriodKey(Date.now())
    const result = await runPayouts(ctx, periodKey)
    console.log(
      `[profit] ${periodKey}: credited ${result.credited} members with AED ${result.totalAed}`,
    )
    return result
  },
})

const payoutValidator = v.object({
  id: v.id("profitPayouts"),
  periodKey: v.string(),
  planName: v.string(),
  level: v.number(),
  percent: v.number(),
  basisAed: v.number(),
  amountAed: v.number(),
  note: v.union(v.string(), v.null()),
  createdAt: v.number(),
})

/** Profit payouts for the signed-in member. */
export const myPayouts = query({
  args: {},
  returns: v.object({
    totalAed: v.number(),
    rows: v.array(payoutValidator),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { totalAed: 0, rows: [] }
    const rows = await ctx.db
      .query("profitPayouts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50)
    return {
      totalAed: round2(rows.reduce((sum, row) => sum + row.amountAed, 0)),
      rows: rows.map((row) => ({
        id: row._id,
        periodKey: row.periodKey,
        planName: row.planName,
        level: row.level,
        percent: row.percent,
        basisAed: row.basisAed,
        amountAed: row.amountAed,
        note: row.note ?? null,
        createdAt: row.createdAt,
      })),
    }
  },
})

/** Administration ledger of every monthly payout plus the next expected amounts. */
export const adminPayouts = query({
  args: {},
  returns: v.object({
    rows: v.array(
      v.object({
        id: v.id("profitPayouts"),
        periodKey: v.string(),
        userId: v.id("users"),
        name: v.string(),
        email: v.string(),
        planName: v.string(),
        level: v.number(),
        percent: v.number(),
        basisAed: v.number(),
        amountAed: v.number(),
        createdAt: v.number(),
      }),
    ),
    totals: v.object({
      paidAed: v.number(),
      payouts: v.number(),
      members: v.number(),
      lastPeriodKey: v.union(v.string(), v.null()),
    }),
    preview: v.array(
      v.object({
        userId: v.id("users"),
        name: v.string(),
        email: v.string(),
        planName: v.string(),
        level: v.number(),
        percent: v.number(),
        basisAed: v.number(),
        amountAed: v.number(),
        alreadyPaid: v.boolean(),
      }),
    ),
    nextPeriodKey: v.string(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const now = Date.now()
    const nextPeriodKey = previousPeriodKey(now)
    const plans = await storedPlans(ctx)

    const rows = await ctx.db.query("profitPayouts").order("desc").take(200)
    const wallets = await ctx.db.query("wallets").collect()
    const investments = await ctx.db.query("investmentRequests").collect()
    const userIds = new Set<Id<"users">>()
    for (const wallet of wallets) userIds.add(wallet.userId)
    for (const row of investments) {
      if (row.status === "funded") userIds.add(row.userId)
    }

    type PreviewRow = {
      userId: Id<"users">
      name: string
      email: string
      planName: string
      level: number
      percent: number
      basisAed: number
      amountAed: number
      alreadyPaid: boolean
    }
    type DetailedRow = {
      id: Id<"profitPayouts">
      periodKey: string
      userId: Id<"users">
      name: string
      email: string
      planName: string
      level: number
      percent: number
      basisAed: number
      amountAed: number
      createdAt: number
    }

    const preview: PreviewRow[] = []
    for (const userId of userIds) {
      const basis = await profitBasis(ctx, userId)
      if (basis.basisAed <= 0) continue
      const level = await levelOf(ctx, userId)
      const plan = planForLevel(plans, level)
      const paid = await ctx.db
        .query("profitPayouts")
        .withIndex("by_user_and_period", (q) =>
          q.eq("userId", userId).eq("periodKey", nextPeriodKey),
        )
        .unique()
      const label = await memberLabel(ctx, userId)
      preview.push({
        userId,
        name: label.name,
        email: label.email,
        planName: plan.name,
        level: plan.level,
        percent: plan.profitPercent,
        basisAed: basis.basisAed,
        amountAed: round2((basis.basisAed * plan.profitPercent) / 100),
        alreadyPaid: paid !== null,
      })
    }
    preview.sort((a, b) => b.amountAed - a.amountAed)

    const detailed: DetailedRow[] = []
    for (const row of rows) {
      const label = await memberLabel(ctx, row.userId)
      detailed.push({
        id: row._id,
        periodKey: row.periodKey,
        userId: row.userId,
        name: label.name,
        email: label.email,
        planName: row.planName,
        level: row.level,
        percent: row.percent,
        basisAed: row.basisAed,
        amountAed: row.amountAed,
        createdAt: row.createdAt,
      })
    }

    return {
      rows: detailed,
      totals: {
        paidAed: round2(rows.reduce((sum, row) => sum + row.amountAed, 0)),
        payouts: rows.length,
        members: new Set(rows.map((row) => row.userId)).size,
        lastPeriodKey: rows.length > 0 ? rows[0].periodKey : null,
      },
      preview,
      nextPeriodKey,
    }
  },
})
