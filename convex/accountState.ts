import { ConvexError, v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"

const stateValue = v.union(v.literal("active"), v.literal("frozen"), v.literal("blocked"))

async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError("You need to be signed in")
  return userId
}

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await requireUser(ctx)
  const row = await ctx.db
    .query("admins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  if (!row) throw new ConvexError("This area is for administrators only")
  return userId
}

/** Standing of the signed-in member: active, frozen or blocked. */
export const myState = query({
  args: {},
  returns: v.object({
    status: v.string(),
    reason: v.union(v.null(), v.string()),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { status: "active", reason: null }

    const row = await ctx.db
      .query("accountStates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    return { status: row?.status ?? "active", reason: row?.reason ?? null }
  },
})

/** Administration: standing record for every member that has one. */
export const adminStates = query({
  args: {},
  returns: v.array(
    v.object({
      userId: v.id("users"),
      status: v.string(),
      reason: v.union(v.null(), v.string()),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const rows = await ctx.db.query("accountStates").collect()
    return rows.map((row) => ({
      userId: row.userId,
      status: row.status,
      reason: row.reason ?? null,
      updatedAt: row.updatedAt,
    }))
  },
})

/** Administration: set a member standing (active, frozen, blocked). */
export const setState = mutation({
  args: {
    userId: v.id("users"),
    status: stateValue,
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx)
    const user = await ctx.db.get(args.userId)
    if (!user) throw new ConvexError("That member no longer exists")

    const now = Date.now()
    const existing = await ctx.db
      .query("accountStates")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique()

    const reason = args.reason?.trim().slice(0, 200) || undefined

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        reason,
        updatedAt: now,
        updatedBy: adminId,
      })
    } else {
      await ctx.db.insert("accountStates", {
        userId: args.userId,
        status: args.status,
        reason,
        updatedAt: now,
        updatedBy: adminId,
      })
    }

    await ctx.db.insert("notifications", {
      kind: "verification",
      title:
        args.status === "active"
          ? "Account reactivated"
          : args.status === "frozen"
            ? "Account assets frozen"
            : "Account blocked",
      body:
        args.status === "active"
          ? "Administration reactivated your account."
          : (reason ?? "Administration updated your account standing."),
      userId: args.userId,
      read: false,
      createdAt: now,
    })
    return null
  },
})

/** Standing for one member, defaulting to active. */
export async function standingOf(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const row = await ctx.db
    .query("accountStates")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  return row?.status ?? "active"
}
