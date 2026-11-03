import { ConvexError, v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"

const MAX_CRYPTO_AED = 50_000_000

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

async function detailsDoc(ctx: QueryCtx | MutationCtx) {
  return await ctx.db.query("paymentDetails").first()
}

const detailsValidator = v.object({
  bankName: v.string(),
  accountName: v.string(),
  accountNumber: v.string(),
  iban: v.string(),
  swift: v.string(),
  note: v.string(),
  crypto: v.array(v.object({ coin: v.string(), network: v.string(), address: v.string() })),
  updatedAt: v.number(),
})

const emptyDetails = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  iban: "",
  swift: "",
  note: "",
  crypto: [] as { coin: string; network: string; address: string }[],
  updatedAt: 0,
}

/** Bank and crypto details for members. */
export const details = query({
  args: {},
  returns: detailsValidator,
  handler: async (ctx) => {
    const row = await detailsDoc(ctx)
    if (!row) return emptyDetails
    return {
      bankName: row.bankName,
      accountName: row.accountName,
      accountNumber: row.accountNumber,
      iban: row.iban,
      swift: row.swift,
      note: row.note,
      crypto: row.crypto,
      updatedAt: row.updatedAt,
    }
  },
})

/** Administration saves the bank and crypto details members see. */
export const saveDetails = mutation({
  args: {
    bankName: v.string(),
    accountName: v.string(),
    accountNumber: v.string(),
    iban: v.string(),
    swift: v.string(),
    note: v.string(),
    crypto: v.array(v.object({ coin: v.string(), network: v.string(), address: v.string() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx)
    const values = {
      bankName: args.bankName.trim(),
      accountName: args.accountName.trim(),
      accountNumber: args.accountNumber.trim(),
      iban: args.iban.trim(),
      swift: args.swift.trim(),
      note: args.note.trim(),
      crypto: args.crypto
        .map((row) => ({
          coin: row.coin.trim(),
          network: row.network.trim(),
          address: row.address.trim(),
        }))
        .filter((row) => row.coin && row.address),
      updatedAt: Date.now(),
      updatedBy: adminId,
    }
    const existing = await detailsDoc(ctx)
    if (existing) {
      await ctx.db.patch(existing._id, values)
    } else {
      await ctx.db.insert("paymentDetails", values)
    }
    return null
  },
})

/** Members upload a crypto payment slip for review. */
export const submit = mutation({
  args: {
    kind: v.union(v.literal("topup"), v.literal("deposit"), v.literal("investment")),
    residence: v.optional(v.string()),
    amountAed: v.number(),
    coin: v.string(),
    network: v.string(),
    address: v.string(),
    txHash: v.optional(v.string()),
    proofId: v.id("_storage"),
    proofName: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.id("cryptoPayments"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const amount = Math.round(args.amountAed)
    if (!Number.isFinite(amount) || amount <= 0) throw new ConvexError("Enter the amount you sent")
    if (amount > MAX_CRYPTO_AED) throw new ConvexError("That amount is above the payment limit")
    if (!args.coin.trim()) throw new ConvexError("Choose a coin")

    const id = await ctx.db.insert("cryptoPayments", {
      userId,
      kind: args.kind,
      residence: args.residence?.trim() || undefined,
      amountAed: amount,
      coin: args.coin.trim(),
      network: args.network.trim(),
      address: args.address.trim(),
      txHash: args.txHash?.trim() || undefined,
      proofId: args.proofId,
      proofName: args.proofName,
      status: "pending",
      note: args.note?.trim() || undefined,
      createdAt: Date.now(),
    })

    await ctx.db.insert("notifications", {
      kind: "topup",
      title: "Crypto payment slip received",
      body: `${args.coin.trim()} · AED ${amount.toLocaleString("en-AE")} waiting for approval`,
      userId,
      createdAt: Date.now(),
      read: false,
    })

    return id
  },
})

/** The member's own crypto payments with slip links. */
export const mine = query({
  args: {},
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        id: v.id("cryptoPayments"),
        kind: v.string(),
        amountAed: v.number(),
        coin: v.string(),
        network: v.string(),
        status: v.string(),
        txHash: v.union(v.string(), v.null()),
        createdAt: v.number(),
      }),
    ),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const rows = await ctx.db
      .query("cryptoPayments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((row) => ({
        id: row._id,
        kind: row.kind,
        amountAed: row.amountAed,
        coin: row.coin,
        network: row.network,
        status: row.status,
        txHash: row.txHash ?? null,
        createdAt: row.createdAt,
      }))
  },
})

/** Administration queue of crypto slips. */
export const adminList = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("cryptoPayments"),
      name: v.string(),
      email: v.string(),
      kind: v.string(),
      residence: v.union(v.string(), v.null()),
      amountAed: v.number(),
      coin: v.string(),
      network: v.string(),
      txHash: v.union(v.string(), v.null()),
      proofUrl: v.union(v.string(), v.null()),
      proofName: v.string(),
      status: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const rows = await ctx.db.query("cryptoPayments").order("desc").take(60)
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
          kind: row.kind,
          residence: row.residence ?? null,
          amountAed: row.amountAed,
          coin: row.coin,
          network: row.network,
          txHash: row.txHash ?? null,
          proofUrl: await ctx.storage.getUrl(row.proofId),
          proofName: row.proofName,
          status: row.status,
          createdAt: row.createdAt,
        }
      }),
    )
  },
})

/** Administration approves or rejects a crypto payment slip. */
export const decide = mutation({
  args: {
    id: v.id("cryptoPayments"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx)
    const row = await ctx.db.get(args.id)
    if (!row) throw new ConvexError("That payment no longer exists")
    if (row.status !== "pending") throw new ConvexError("That payment is already decided")

    const now = Date.now()
    if (args.decision === "approve") {
      await ctx.db.insert("walletTransactions", {
        userId: row.userId,
        type: "topup",
        amountAed: row.amountAed,
        status: "completed",
        note: `Crypto payment approved · ${row.coin}${row.residence ? ` · ${row.residence}` : ""}`,
        residence: row.residence,
        createdAt: now,
        createdBy: adminId,
      })
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", row.userId))
        .unique()
      if (wallet) {
        await ctx.db.patch(wallet._id, { updatedAt: now })
      } else {
        await ctx.db.insert("wallets", { userId: row.userId, createdAt: now, updatedAt: now })
      }
    }

    await ctx.db.patch(row._id, {
      status: args.decision === "approve" ? "approved" : "rejected",
      reviewedAt: now,
      reviewedBy: adminId,
    })
    return null
  },
})
