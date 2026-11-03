import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new Error("You need to be signed in")
  const row = await ctx.db
    .query("admins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  if (!row) throw new Error("This area is for administrators only")
  return userId
}

/** Price labels set by administration, keyed by residence slug. */
export const prices = query({
  args: {},
  returns: v.array(
    v.object({
      slug: v.string(),
      priceLabel: v.string(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("propertyPrices").collect()
    return rows.map((row) => ({
      slug: row.slug,
      priceLabel: row.priceLabel,
      updatedAt: row.updatedAt,
    }))
  },
})

/** Administration only: update the published price of a residence. */
export const setPrice = mutation({
  args: { slug: v.string(), priceLabel: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx)
    const slug = args.slug.trim()
    const priceLabel = args.priceLabel.trim()
    if (slug.length < 2) throw new Error("Choose a residence")
    if (priceLabel.length < 3 || priceLabel.length > 60) {
      throw new Error("Enter a price between 3 and 60 characters, for example From AED 18.5M")
    }

    const existing = await ctx.db
      .query("propertyPrices")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        priceLabel,
        updatedAt: Date.now(),
        updatedBy: adminId,
      })
    } else {
      await ctx.db.insert("propertyPrices", {
        slug,
        priceLabel,
        updatedAt: Date.now(),
        updatedBy: adminId,
      })
    }
    return null
  },
})
