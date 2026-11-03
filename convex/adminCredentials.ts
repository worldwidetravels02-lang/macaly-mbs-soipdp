import { ConvexError, v } from "convex/values"
import { getAuthUserId, modifyAccountCredentials } from "@convex-dev/auth/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { action, internalMutation, internalQuery, query } from "./_generated/server"
import { internal } from "./_generated/api"

const MIN_PASSWORD_LENGTH = 8

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

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase()
}

/** The signed-in administrator's current login email. */
export const currentLogin = query({
  args: {},
  returns: v.object({ email: v.string() }),
  handler: async (ctx) => {
    const userId = await requireAdmin(ctx)
    const user = await ctx.db.get(userId)
    return { email: user?.email ?? "" }
  },
})

export const loginState = internalQuery({
  args: {},
  returns: v.object({ userId: v.id("users"), email: v.string(), accountId: v.string() }),
  handler: async (ctx) => {
    const userId = await requireAdmin(ctx)
    const user = await ctx.db.get(userId)
    if (!user) throw new ConvexError("That administrator no longer exists")
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("provider"), "password"))
      .unique()
    return {
      userId,
      email: normaliseEmail(user.email ?? ""),
      accountId: account?.providerAccountId ?? normaliseEmail(user.email ?? ""),
    }
  },
})

export const emailTaken = internalQuery({
  args: { email: v.string(), userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", args.email),
      )
      .unique()
    if (account && account.userId !== args.userId) return true
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique()
    return Boolean(user && user._id !== args.userId)
  },
})

export const applyEmail = internalMutation({
  args: { userId: v.id("users"), accountId: v.string(), email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", args.accountId),
      )
      .unique()
    if (account) {
      await ctx.db.patch(account._id, { providerAccountId: args.email })
    }
    await ctx.db.patch(args.userId, { email: args.email })
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique()
    if (admin) {
      await ctx.db.patch(admin._id, { email: args.email })
    }
    return null
  },
})

/**
 * Lets a signed-in administrator change their own login email and password.
 * Leave a field empty to keep it unchanged.
 */
export const updateLogin = action({
  args: {
    email: v.optional(v.string()),
    password: v.optional(v.string()),
  },
  returns: v.object({ email: v.string(), passwordChanged: v.boolean() }),
  handler: async (ctx, args) => {
    const state = await ctx.runQuery(internal.adminCredentials.loginState, {})
    const nextEmail = args.email?.trim() ? normaliseEmail(args.email) : state.email
    const password = args.password ?? ""

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      throw new ConvexError("Enter a valid email address")
    }
    if (password.length > 0 && password.length < MIN_PASSWORD_LENGTH) {
      throw new ConvexError(`Use at least ${MIN_PASSWORD_LENGTH} characters for the password`)
    }
    if (nextEmail === state.email && password.length === 0) {
      throw new ConvexError("Enter a new email or a new password")
    }
    if (nextEmail !== state.email) {
      const taken = await ctx.runQuery(internal.adminCredentials.emailTaken, {
        email: nextEmail,
        userId: state.userId,
      })
      if (taken) throw new ConvexError("Another account already uses that email")
      await ctx.runMutation(internal.adminCredentials.applyEmail, {
        userId: state.userId,
        accountId: state.accountId,
        email: nextEmail,
      })
    }

    if (password.length > 0) {
      await modifyAccountCredentials(ctx, {
        provider: "password",
        account: { id: nextEmail, secret: password },
      })
    }

    return { email: nextEmail, passwordChanged: password.length > 0 }
  },
})
