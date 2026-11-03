import { ConvexError, v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation } from "./_generated/server"
import { TIERS } from "./tiers"

/** Every member starts at Level 1 and only administration moves them up. */
export const DEFAULT_LEVEL = 1

export function tierNameForLevel(level: number): string {
  const tier = TIERS.find((row) => row.level === level) ?? TIERS[0]
  return tier.name
}

export async function levelOf(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<number> {
  const profile = await ctx.db
    .query("memberProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  const level = profile?.membershipLevel
  if (typeof level !== "number" || !Number.isFinite(level)) return DEFAULT_LEVEL
  return Math.min(Math.max(Math.round(level), 1), TIERS.length)
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

/** Administration sets a member membership level. */
export const setLevel = mutation({
  args: { userId: v.id("users"), level: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    if (!Number.isInteger(args.level) || args.level < 1 || args.level > TIERS.length) {
      throw new ConvexError("Choose a level between 1 and " + TIERS.length)
    }
    const profile = await ctx.db
      .query("memberProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique()
    if (profile) {
      await ctx.db.patch(profile._id, { membershipLevel: args.level })
      return null
    }
    const user = await ctx.db.get(args.userId)
    await ctx.db.insert("memberProfiles", {
      userId: args.userId,
      fullName: user?.name?.trim() || user?.email || "Member",
      mobile: "",
      membershipLevel: args.level,
    })
    return null
  },
})
