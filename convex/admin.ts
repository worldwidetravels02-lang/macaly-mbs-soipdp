import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { memberWalletSnapshot } from "./wallet"

type InvestorRow = {
  userId: Id<"users">
  name: string
  email: string
  mobile: string
  level: number
  tierName: string
  balanceAed: number
  totalTopUpAed: number
  totalWithdrawnAed: number
  pendingWithdrawalAed: number
  pendingTopUpAed: number
  joinedAt: number
}

type PendingTopUpRow = {
  id: Id<"topUpRequests">
  userId: Id<"users">
  name: string
  email: string
  mobile: string
  amountAed: number
  method: string
  reference: string | null
  residence: string | null
  createdAt: number
}

type PendingWithdrawalRow = {
  id: Id<"withdrawalRequests">
  userId: Id<"users">
  name: string
  email: string
  amountAed: number
  iban: string
  createdAt: number
}

async function adminRow(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  return await ctx.db
    .query("admins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
}

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new Error("You need to be signed in")
  const admin = await adminRow(ctx, userId)
  if (!admin) throw new Error("This area is for administrators only")
  return userId
}

/** Tells the client whether it may open the administration area. */
export const status = query({
  args: {},
  returns: v.object({
    isAdmin: v.boolean(),
    adminExists: v.boolean(),
    signedIn: v.boolean(),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    const admins = await ctx.db.query("admins").collect()
    const isAdmin = userId ? Boolean(await adminRow(ctx, userId)) : false
    return { isAdmin, adminExists: admins.length > 0, signedIn: Boolean(userId) }
  },
})

/** Automatic promotion by email is deliberately disabled. */
export const ensureAdmin = mutation({
  args: {},
  returns: v.null(),
  handler: async () => null,
})

/** Public self-claim is disabled; first admin must use the protected setup action. */
export const claimAdmin = mutation({
  args: {},
  returns: v.null(),
  handler: async () => {
    throw new Error("Use the protected owner administrator setup flow")
  },
})

/** Adds another administrator by email address. */
export const grantAdmin = mutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const email = args.email.trim().toLowerCase()
    if (!email.includes("@")) throw new Error("Enter a valid email address")

    const users = await ctx.db.query("users").collect()
    const target = users.find((user) => (user.email ?? "").toLowerCase() === email)
    if (!target) throw new Error("No member is registered with that email address")

    const existing = await adminRow(ctx, target._id)
    if (existing) throw new Error("That member is already an administrator")

    await ctx.db.insert("admins", {
      userId: target._id,
      email: target.email ?? email,
      role: "admin",
      createdAt: Date.now(),
    })
    return null
  },
})

/** Everything administration needs: investors, balances, pending money movement. */
export const overview = query({
  args: {},
  returns: v.object({
    totals: v.object({
      investors: v.number(),
      walletBalanceAed: v.number(),
      approvedTopUpAed: v.number(),
      withdrawnAed: v.number(),
      pendingTopUps: v.number(),
      pendingWithdrawals: v.number(),
      bonusPaidAed: v.number(),
    }),
    investors: v.array(
      v.object({
        userId: v.id("users"),
        name: v.string(),
        email: v.string(),
        mobile: v.string(),
        level: v.number(),
        tierName: v.string(),
        balanceAed: v.number(),
        totalTopUpAed: v.number(),
        totalWithdrawnAed: v.number(),
        pendingWithdrawalAed: v.number(),
        pendingTopUpAed: v.number(),
        joinedAt: v.number(),
      }),
    ),
    pendingTopUps: v.array(
      v.object({
        id: v.id("topUpRequests"),
        userId: v.id("users"),
        name: v.string(),
        email: v.string(),
        mobile: v.string(),
        amountAed: v.number(),
        method: v.string(),
        reference: v.union(v.string(), v.null()),
        residence: v.union(v.string(), v.null()),
        createdAt: v.number(),
      }),
    ),
    notifications: v.array(
      v.object({
        id: v.id("notifications"),
        kind: v.string(),
        title: v.string(),
        body: v.string(),
        read: v.boolean(),
        createdAt: v.number(),
      }),
    ),
    unreadNotifications: v.number(),
    admins: v.array(
      v.object({
        userId: v.id("users"),
        email: v.string(),
        role: v.string(),
        createdAt: v.number(),
      }),
    ),
    pendingWithdrawals: v.array(
      v.object({
        id: v.id("withdrawalRequests"),
        userId: v.id("users"),
        name: v.string(),
        email: v.string(),
        amountAed: v.number(),
        iban: v.string(),
        createdAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const wallets = await ctx.db.query("wallets").collect()
    const profiles = await ctx.db.query("memberProfiles").collect()
    const pendingTopUpRows = await ctx.db
      .query("topUpRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect()
    const pendingWithdrawalRows = await ctx.db
      .query("withdrawalRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect()

    const userIds = new Set<Id<"users">>()
    for (const wallet of wallets) userIds.add(wallet.userId)
    for (const profile of profiles) userIds.add(profile.userId)

    const investors: InvestorRow[] = []
    let walletBalanceAed = 0
    let approvedTopUpAed = 0
    let withdrawnAed = 0
    let bonusPaidAed = 0

    for (const userId of userIds) {
      const user = await ctx.db.get(userId)
      const profile = profiles.find((row) => row.userId === userId)
      const snapshot = await memberWalletSnapshot(ctx, userId)
      const pendingTopUpAed = pendingTopUpRows
        .filter((row) => row.userId === userId)
        .reduce((sum, row) => sum + row.amountAed, 0)

      walletBalanceAed += snapshot.balanceAed
      approvedTopUpAed += snapshot.totalTopUpAed
      withdrawnAed += snapshot.totalWithdrawnAed
      bonusPaidAed += snapshot.balanceAed >= 200 ? 200 : 0

      investors.push({
        userId,
        name: profile?.fullName ?? user?.name ?? "Member",
        email: user?.email ?? "",
        mobile: profile?.mobile ?? "",
        level: snapshot.level,
        tierName: snapshot.tierName,
        balanceAed: snapshot.balanceAed,
        totalTopUpAed: snapshot.totalTopUpAed,
        totalWithdrawnAed: snapshot.totalWithdrawnAed,
        pendingWithdrawalAed: snapshot.pendingWithdrawalAed,
        pendingTopUpAed,
        joinedAt: user?._creationTime ?? 0,
      })
    }

    investors.sort((a, b) => b.totalTopUpAed - a.totalTopUpAed)

    const pendingTopUps: PendingTopUpRow[] = []
    for (const row of pendingTopUpRows) {
      const user = await ctx.db.get(row.userId)
      const profile = profiles.find((item) => item.userId === row.userId)
      pendingTopUps.push({
        id: row._id,
        userId: row.userId,
        name: profile?.fullName ?? user?.name ?? "Member",
        email: user?.email ?? "",
        mobile: profile?.mobile ?? "",
        amountAed: row.amountAed,
        method: row.method,
        reference: row.reference ?? null,
        residence: row.residence ?? null,
        createdAt: row.createdAt,
      })
    }
    pendingTopUps.sort((a, b) => a.createdAt - b.createdAt)

    const pendingWithdrawals: PendingWithdrawalRow[] = []
    for (const row of pendingWithdrawalRows) {
      const user = await ctx.db.get(row.userId)
      const profile = profiles.find((item) => item.userId === row.userId)
      pendingWithdrawals.push({
        id: row._id,
        userId: row.userId,
        name: profile?.fullName ?? user?.name ?? "Member",
        email: user?.email ?? "",
        amountAed: row.amountAed,
        iban: row.iban,
        createdAt: row.createdAt,
      })
    }
    pendingWithdrawals.sort((a, b) => a.createdAt - b.createdAt)

    const adminRows = await ctx.db.query("admins").collect()
    const notificationRows = await ctx.db
      .query("notifications")
      .withIndex("by_read")
      .order("desc")
      .take(30)

    return {
      totals: {
        investors: investors.length,
        walletBalanceAed,
        approvedTopUpAed,
        withdrawnAed,
        pendingTopUps: pendingTopUps.length,
        pendingWithdrawals: pendingWithdrawals.length,
        bonusPaidAed,
      },
      investors,
      pendingTopUps,
      pendingWithdrawals,
      notifications: notificationRows.map((row) => ({
        id: row._id,
        kind: row.kind,
        title: row.title,
        body: row.body,
        read: row.read,
        createdAt: row.createdAt,
      })),
      unreadNotifications: notificationRows.filter((row) => !row.read).length,
      admins: adminRows
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((row) => ({
          userId: row.userId,
          email: row.email,
          role: row.role,
          createdAt: row.createdAt,
        })),
    }
  },
})

/** Administration only: records a payment straight into a member wallet. */
export const creditMember = mutation({
  args: {
    userId: v.id("users"),
    amountAed: v.number(),
    note: v.optional(v.string()),
    residence: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx)
    const amount = Math.round(args.amountAed)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter the payment amount")
    if (amount > 20_000_000) throw new Error("That amount is above the payment limit")

    const user = await ctx.db.get(args.userId)
    if (!user) throw new Error("That member no longer exists")

    const now = Date.now()
    await ctx.db.insert("walletTransactions", {
      userId: args.userId,
      type: "topup",
      amountAed: amount,
      status: "completed",
      note: args.note?.trim() ? `Admin payment · ${args.note.trim()}` : "Admin payment",
      residence: args.residence?.trim() || undefined,
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

/** Bank deposit records with member details, newest first. */
export const depositRecords = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("topUpRequests"),
      name: v.string(),
      email: v.string(),
      amountAed: v.number(),
      method: v.string(),
      reference: v.union(v.string(), v.null()),
      residence: v.union(v.string(), v.null()),
      status: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const rows = await ctx.db.query("topUpRequests").order("desc").take(60)
    return await Promise.all(
      rows.map(async (row) => {
        const user = await ctx.db.get(row.userId)
        const profile = await ctx.db
          .query("memberProfiles")
          .withIndex("by_user", (q) => q.eq("userId", row.userId))
          .unique()
        return {
          id: row._id,
          name: profile?.fullName?.trim() || user?.name?.trim() || user?.email || "Member",
          email: user?.email ?? "",
          amountAed: row.amountAed,
          method: row.method,
          reference: row.reference ?? null,
          residence: row.residence ?? null,
          status: row.status,
          createdAt: row.createdAt,
        }
      }),
    )
  },
})

/** Every withdrawal request with its current status, newest first. */
export const withdrawalRecords = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("withdrawalRequests"),
      name: v.string(),
      email: v.string(),
      amountAed: v.number(),
      iban: v.string(),
      status: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const rows = await ctx.db.query("withdrawalRequests").order("desc").take(60)
    return await Promise.all(
      rows.map(async (row) => {
        const user = await ctx.db.get(row.userId)
        const profile = await ctx.db
          .query("memberProfiles")
          .withIndex("by_user", (q) => q.eq("userId", row.userId))
          .unique()
        return {
          id: row._id,
          name: profile?.fullName?.trim() || user?.name?.trim() || user?.email || "Member",
          email: user?.email ?? "",
          amountAed: row.amountAed,
          iban: row.iban,
          status: row.status,
          createdAt: row.createdAt,
        }
      }),
    )
  },
})

/** Clears the administration alert list. */
export const markNotificationsRead = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_read", (q) => q.eq("read", false))
      .collect()
    for (const row of unread) {
      await ctx.db.patch(row._id, { read: true })
    }
    return null
  },
})

/** Removes administration access from an account. */
export const revokeAdmin = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const row = await adminRow(ctx, args.userId)
    if (!row) throw new Error("That account is not an administrator")
    await ctx.db.delete(row._id)
    return null
  },
})

/** Approves or rejects a recorded top-up. Approval credits the wallet. */
export const decideTopUp = mutation({
  args: { requestId: v.id("topUpRequests"), approve: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx)
    const request = await ctx.db.get(args.requestId)
    if (!request) throw new Error("That request no longer exists")
    if (request.status !== "pending") throw new Error("That request has already been reviewed")

    await ctx.db.patch(request._id, {
      status: args.approve ? "approved" : "rejected",
      reviewedAt: Date.now(),
      reviewedBy: adminId,
    })

    if (args.approve) {
      await ctx.db.insert("walletTransactions", {
        userId: request.userId,
        type: "topup",
        amountAed: request.amountAed,
        status: "completed",
        note: request.reference ? `Top-up · ${request.reference}` : "Top-up approved",
        residence: request.residence,
        createdAt: Date.now(),
        createdBy: adminId,
      })
    }
    return null
  },
})

/** Approves or rejects a withdrawal request. Approval debits the wallet. */
export const decideWithdrawal = mutation({
  args: { requestId: v.id("withdrawalRequests"), approve: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx)
    const request = await ctx.db.get(args.requestId)
    if (!request) throw new Error("That request no longer exists")
    if (request.status !== "pending") throw new Error("That request has already been reviewed")

    if (args.approve) {
      const snapshot = await memberWalletSnapshot(ctx, request.userId)
      if (request.amountAed > snapshot.balanceAed) {
        throw new Error("The member balance no longer covers this withdrawal")
      }
    }

    await ctx.db.patch(request._id, {
      status: args.approve ? "approved" : "rejected",
      reviewedAt: Date.now(),
      reviewedBy: adminId,
    })

    if (args.approve) {
      await ctx.db.insert("walletTransactions", {
        userId: request.userId,
        type: "withdrawal",
        amountAed: request.amountAed,
        status: "completed",
        note: `Withdrawal to ${request.iban.slice(-4).padStart(request.iban.length, "•")}`,
        createdAt: Date.now(),
        createdBy: adminId,
      })
    }
    return null
  },
})
