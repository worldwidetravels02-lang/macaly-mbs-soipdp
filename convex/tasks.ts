import { ConvexError, v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { TIERS } from "./tiers"

/**
 * Task driven level unlocking. Administration assigns a task with a target
 * level, the member completes it, and approval moves them to that level.
 */

export const taskStatus = v.union(
  v.literal("pending"),
  v.literal("submitted"),
  v.literal("approved"),
  v.literal("rejected"),
)

const taskRow = v.object({
  id: v.id("memberTasks"),
  title: v.string(),
  detail: v.union(v.string(), v.null()),
  targetLevel: v.number(),
  targetLevelName: v.string(),
  status: taskStatus,
  createdAt: v.number(),
  submittedAt: v.union(v.number(), v.null()),
  reviewedAt: v.union(v.number(), v.null()),
  reviewNote: v.union(v.string(), v.null()),
})

const adminTaskRow = v.object({
  id: v.id("memberTasks"),
  userId: v.id("users"),
  name: v.string(),
  email: v.string(),
  mobile: v.string(),
  title: v.string(),
  detail: v.union(v.string(), v.null()),
  targetLevel: v.number(),
  targetLevelName: v.string(),
  status: taskStatus,
  createdAt: v.number(),
  submittedAt: v.union(v.number(), v.null()),
})

function levelName(level: number): string {
  return TIERS.find((tier) => tier.level === level)?.name ?? `Level ${level}`
}

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError("You need to be signed in")
  const row = await ctx.db
    .query("admins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  if (!row) throw new ConvexError("This area is for administrators only")
  return userId
}

/** Tasks assigned to the signed-in member. */
export const myTasks = query({
  args: {},
  returns: v.array(taskRow),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const rows = await ctx.db
      .query("memberTasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((row) => ({
        id: row._id,
        title: row.title,
        detail: row.detail ?? null,
        targetLevel: row.targetLevel,
        targetLevelName: levelName(row.targetLevel),
        status: row.status,
        createdAt: row.createdAt,
        submittedAt: row.submittedAt ?? null,
        reviewedAt: row.reviewedAt ?? null,
        reviewNote: row.reviewNote ?? null,
      }))
  },
})

/** The member marks an assigned task as done. */
export const submit = mutation({
  args: { id: v.id("memberTasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError("You need to be signed in")
    const row = await ctx.db.get(args.id)
    if (!row || row.userId !== userId) throw new ConvexError("That task was not found")
    if (row.status !== "pending" && row.status !== "rejected") {
      throw new ConvexError("That task is already with administration")
    }
    await ctx.db.patch(row._id, { status: "submitted", submittedAt: Date.now() })
    return null
  },
})

/** Administration task queue. */
export const adminTasks = query({
  args: {},
  returns: v.array(adminTaskRow),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const rows = await ctx.db.query("memberTasks").collect()
    const out: Array<{
      id: Id<"memberTasks">
      userId: Id<"users">
      name: string
      email: string
      mobile: string
      title: string
      detail: string | null
      targetLevel: number
      targetLevelName: string
      status: "pending" | "submitted" | "approved" | "rejected"
      createdAt: number
      submittedAt: number | null
    }> = []
    for (const row of rows) {
      const user = await ctx.db.get(row.userId)
      const profile = await ctx.db
        .query("memberProfiles")
        .withIndex("by_user", (q) => q.eq("userId", row.userId))
        .unique()
      out.push({
        id: row._id,
        userId: row.userId,
        name: profile?.fullName || user?.name || "Member",
        email: user?.email ?? "",
        mobile: profile?.mobile ?? "",
        title: row.title,
        detail: row.detail ?? null,
        targetLevel: row.targetLevel,
        targetLevelName: levelName(row.targetLevel),
        status: row.status,
        createdAt: row.createdAt,
        submittedAt: row.submittedAt ?? null,
      })
    }
    return out.sort((a, b) => b.createdAt - a.createdAt)
  },
})

/** Administration assigns a task that unlocks a level. */
export const assign = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    detail: v.optional(v.string()),
    targetLevel: v.number(),
  },
  returns: v.id("memberTasks"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const title = args.title.trim()
    if (title.length < 3) throw new ConvexError("Give the task a short title")
    if (!Number.isInteger(args.targetLevel) || args.targetLevel < 1 || args.targetLevel > TIERS.length) {
      throw new ConvexError("Choose a level between 1 and " + TIERS.length)
    }
    const user = await ctx.db.get(args.userId)
    if (!user) throw new ConvexError("That member was not found")
    return await ctx.db.insert("memberTasks", {
      userId: args.userId,
      title,
      detail: args.detail?.trim() || undefined,
      targetLevel: args.targetLevel,
      status: "pending",
      createdAt: Date.now(),
    })
  },
})

/** Approving a task unlocks the target level for the member. */
export const decide = mutation({
  args: {
    id: v.id("memberTasks"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const row = await ctx.db.get(args.id)
    if (!row) throw new ConvexError("That task no longer exists")
    if (row.status === "approved") throw new ConvexError("That task is already approved")

    if (args.decision === "reject") {
      const note = args.note?.trim()
      await ctx.db.patch(row._id, {
        status: "rejected",
        reviewedAt: Date.now(),
        reviewNote: note || undefined,
      })
      return null
    }

    await ctx.db.patch(row._id, {
      status: "approved",
      reviewedAt: Date.now(),
      reviewNote: args.note?.trim() || undefined,
    })

    const profile = await ctx.db
      .query("memberProfiles")
      .withIndex("by_user", (q) => q.eq("userId", row.userId))
      .unique()
    if (profile) {
      const current = profile.membershipLevel ?? 1
      if (row.targetLevel > current) {
        await ctx.db.patch(profile._id, { membershipLevel: row.targetLevel })
      }
      return null
    }
    const user = await ctx.db.get(row.userId)
    await ctx.db.insert("memberProfiles", {
      userId: row.userId,
      fullName: user?.name?.trim() || user?.email || "Member",
      mobile: "",
      membershipLevel: row.targetLevel,
    })
    return null
  },
})

/** Administration removes a task. */
export const remove = mutation({
  args: { id: v.id("memberTasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const row = await ctx.db.get(args.id)
    if (!row) return null
    await ctx.db.delete(row._id)
    return null
  },
})
