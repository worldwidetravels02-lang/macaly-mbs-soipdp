import { v } from "convex/values"
import { mutation } from "./_generated/server"

/** Saves a site-visit or brochure enquiry from the public website. */
export const create = mutation({
  args: {
    name: v.string(),
    mobile: v.string(),
    email: v.optional(v.string()),
    residence: v.string(),
    message: v.optional(v.string()),
    source: v.string(),
  },
  returns: v.id("enquiries"),
  handler: async (ctx, args) => {
    const name = args.name.trim()
    const mobile = args.mobile.trim()

    if (name.length < 2) throw new Error("Please enter your name")
    if (mobile.replace(/\D/g, "").length < 7) throw new Error("Please enter a valid mobile number")

    return await ctx.db.insert("enquiries", {
      name,
      mobile,
      email: args.email?.trim() || undefined,
      residence: args.residence,
      message: args.message?.trim() || undefined,
      source: args.source,
    })
  },
})
