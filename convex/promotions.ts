import { ConvexError, v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"

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

/** Live offers, shown on listing cards and residence pages. */
export const activePromotions = query({
  args: {},
  returns: v.array(
    v.object({
      slug: v.string(),
      title: v.string(),
      detail: v.union(v.null(), v.string()),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("promotions")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect()
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      detail: row.detail ?? null,
    }))
  },
})

/** Administration: every offer with its state. */
export const adminPromotions = query({
  args: {},
  returns: v.array(
    v.object({
      promotionId: v.id("promotions"),
      slug: v.string(),
      title: v.string(),
      detail: v.union(v.null(), v.string()),
      active: v.boolean(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const rows = await ctx.db.query("promotions").collect()
    return rows
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((row) => ({
        promotionId: row._id,
        slug: row.slug,
        title: row.title,
        detail: row.detail ?? null,
        active: row.active,
        updatedAt: row.updatedAt,
      }))
  },
})

/** Administration: publish a new offer for one listing. */
export const createPromotion = mutation({
  args: { slug: v.string(), title: v.string(), detail: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx)
    const slug = args.slug.trim()
    const title = args.title.trim()
    if (slug.length < 2) throw new ConvexError("Choose a listing for this offer")
    if (title.length < 3 || title.length > 80) {
      throw new ConvexError("Enter an offer between 3 and 80 characters, for example 5% off list price")
    }

    const now = Date.now()
    await ctx.db.insert("promotions", {
      slug,
      title,
      detail: args.detail?.trim().slice(0, 240) || undefined,
      active: true,
      createdAt: now,
      updatedAt: now,
      updatedBy: adminId,
    })
    return null
  },
})

/** Administration: turn an offer on or off. */
export const setPromotionActive = mutation({
  args: { promotionId: v.id("promotions"), active: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx)
    const row = await ctx.db.get(args.promotionId)
    if (!row) throw new ConvexError("That offer no longer exists")
    await ctx.db.patch(row._id, {
      active: args.active,
      updatedAt: Date.now(),
      updatedBy: adminId,
    })
    return null
  },
})

/** Administration: remove an offer permanently. */
export const deletePromotion = mutation({
  args: { promotionId: v.id("promotions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const row = await ctx.db.get(args.promotionId)
    if (row) await ctx.db.delete(row._id)
    return null
  },
})
