import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { mutation, query } from "./_generated/server"

const profileFields = v.object({
  fullName: v.string(),
  mobile: v.string(),
  referralCode: v.union(v.string(), v.null()),
  interest: v.union(v.string(), v.null()),
  address: v.union(v.string(), v.null()),
})

/** Stores the member details captured by the registration form. */
export const saveProfile = mutation({
  args: {
    fullName: v.string(),
    mobile: v.string(),
    referralCode: v.optional(v.string()),
    interest: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("You need to be signed in to save your details")

    const fullName = args.fullName.trim()
    const mobile = args.mobile.trim()
    if (fullName.length < 2) throw new Error("Please enter your full name")
    if (mobile.replace(/\D/g, "").length < 7) throw new Error("Please enter a valid mobile number")

    const existing = await ctx.db
      .query("memberProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()

    const address = args.address === undefined ? existing?.address : args.address.trim() || undefined

    const data = {
      userId,
      fullName,
      mobile,
      membershipLevel: existing?.membershipLevel ?? 1,
      referralCode: args.referralCode?.trim() || existing?.referralCode || undefined,
      interest: args.interest?.trim() || existing?.interest || undefined,
      address,
    }

    if (existing) {
      await ctx.db.patch(existing._id, data)
    } else {
      await ctx.db.insert("memberProfiles", data)
    }

    return null
  },
})

/** The signed-in member's account details. */
export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      email: v.union(v.string(), v.null()),
      name: v.union(v.string(), v.null()),
      profile: v.union(profileFields, v.null()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const user = await ctx.db.get(userId)
    const profile = await ctx.db
      .query("memberProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()

    return {
      email: user?.email ?? null,
      name: user?.name ?? null,
      profile: profile
        ? {
            fullName: profile.fullName,
            mobile: profile.mobile,
            referralCode: profile.referralCode ?? null,
            interest: profile.interest ?? null,
            address: profile.address ?? null,
          }
        : null,
    }
  },
})

/** Finds the sign-in email for a member mobile number, so login can use mobile. */
export const loginEmailForMobile = query({
  args: { mobile: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const digits = args.mobile.replace(/\D/g, "")
    if (digits.length < 7) return null
    const profiles = await ctx.db.query("memberProfiles").collect()
    const match = profiles.find((row) => {
      const stored = row.mobile.replace(/\D/g, "")
      if (stored === digits) return true
      return stored.length >= 9 && digits.length >= 9 && stored.slice(-9) === digits.slice(-9)
    })
    if (!match) return null
    const user = await ctx.db.get(match.userId)
    return user?.email ?? null
  },
})
