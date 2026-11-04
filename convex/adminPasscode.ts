import { ConvexError, v } from "convex/values"
import { createAccount, getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server"
import { internal } from "./_generated/api"

/** Default administration passcode, used until an administrator changes it. */
const DEFAULT_PASSCODE = "11223344"

const SETTINGS_KEY = "admin-passcode"
const OWNER_EMAIL = "admin01@gmail.com"

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
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

async function storedHash(ctx: QueryCtx | MutationCtx): Promise<string> {
  const row = await ctx.db
    .query("adminSettings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .unique()
  return row?.passcodeHash ?? sha256Hex(DEFAULT_PASSCODE)
}

/** Checks the administration passcode. Only administrators can call this. */
export const unlock = mutation({
  args: { passcode: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const attempt = args.passcode.trim()
    if (attempt === "") return false
    const expected = await storedHash(ctx)
    return (await sha256Hex(attempt)) === expected
  },
})

/**
 * Activates administration for the signed-in account when the administration
 * passcode matches. This lets an owner recover access on a fresh deployment
 * without an existing administrator session.
 */
export const activateAdmin = mutation({
  args: { passcode: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError("Sign in first")
    const user = await ctx.db.get(userId)
    const email = (user?.email ?? "").trim().toLowerCase()
    if (email !== OWNER_EMAIL) throw new ConvexError("Only the configured site owner can activate first administrator access")
    const attempt = args.passcode.trim()
    if (attempt === "") throw new ConvexError("Enter the admin passcode")
    const expected = await storedHash(ctx)
    if ((await sha256Hex(attempt)) !== expected) {
      throw new ConvexError("That passcode is not correct")
    }
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (existing) return null
    const user = await ctx.db.get(userId)
    const email = (user?.email ?? "").trim().toLowerCase()
    if (!email) throw new ConvexError("Add an email to this account first")
    await ctx.db.insert("admins", {
      userId,
      email,
      role: "admin",
      createdAt: Date.now(),
    })
    return null
  },
})


export const passcodeHash = internalQuery({
  args: {},
  returns: v.string(),
  handler: async (ctx) => await storedHash(ctx),
})

export const userByEmail = internalQuery({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique()
    return user !== null
  },
})

export const grantAdminByEmail = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique()
    if (!user) throw new ConvexError("That account could not be found")
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique()
    if (existing) return null
    await ctx.db.insert("admins", {
      userId: user._id,
      email: args.email,
      role: "admin",
      createdAt: Date.now(),
    })
    return null
  },
})

/**
 * Creates an administrator account with email and password. The administration
 * passcode authorises the creation, so an owner can set up access on a fresh
 * deployment without an existing administrator session.
 */
export const createAdminAccount = action({
  args: { email: v.string(), password: v.string(), passcode: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase()
    if (email !== OWNER_EMAIL) {
      throw new ConvexError("Use the configured site owner email to create the first administrator account")
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ConvexError("Enter a valid email address")
    }
    if (args.password.length < 8) {
      throw new ConvexError("Use at least 8 characters for the password")
    }
    const expected = await ctx.runQuery(internal.adminPasscode.passcodeHash, {})
    if ((await sha256Hex(args.passcode.trim())) !== expected) {
      throw new ConvexError("That passcode is not correct")
    }
    const exists = await ctx.runQuery(internal.adminPasscode.userByEmail, { email })
    if (exists) {
      throw new ConvexError("That email already has an account. Sign in, then activate administration.")
    }
    await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: args.password },
      profile: { email },
    })
    await ctx.runMutation(internal.adminPasscode.grantAdminByEmail, { email })
    return null
  },
})

/** Replaces the administration passcode. Requires the current passcode. */
export const setPasscode = mutation({
  args: { current: v.string(), next: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx)
    const expected = await storedHash(ctx)
    if ((await sha256Hex(args.current.trim())) !== expected) {
      throw new ConvexError("The current passcode is not correct")
    }
    const next = args.next.trim()
    if (next.length < 8) {
      throw new ConvexError("Use a passcode of at least 8 characters")
    }
    const hash = await sha256Hex(next)
    const existing = await ctx.db
      .query("adminSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique()
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, { passcodeHash: hash, updatedAt: now, updatedBy: adminId })
    } else {
      await ctx.db.insert("adminSettings", {
        key: SETTINGS_KEY,
        passcodeHash: hash,
        updatedAt: now,
        updatedBy: adminId,
      })
    }
    return null
  },
})

/** Whether a custom passcode has replaced the default one. */
export const status = query({
  args: {},
  returns: v.object({ custom: v.boolean() }),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const row = await ctx.db
      .query("adminSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique()
    return { custom: row !== undefined }
  },
})
