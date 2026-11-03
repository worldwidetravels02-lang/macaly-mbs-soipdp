import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"

async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new Error("You need to be signed in")
  return userId
}

async function isAdmin(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const row = await ctx.db
    .query("admins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  return Boolean(row)
}

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await requireUser(ctx)
  if (!(await isAdmin(ctx, userId))) throw new Error("This area is for administrators only")
  return userId
}

type AdminThreadRow = {
  threadId: Id<"supportThreads">
  userId: Id<"users">
  name: string
  email: string
  status: string
  unreadForAdmin: number
  lastMessageAt: number
  lastMessage: string
}

async function memberLabel(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId)
  const profile = await ctx.db
    .query("memberProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  return {
    name: profile?.fullName ?? user?.name ?? "Member",
    email: user?.email ?? "",
    mobile: profile?.mobile ?? "",
  }
}

/** The signed-in member's support conversation. */
export const myThread = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      threadId: v.id("supportThreads"),
      status: v.string(),
      unreadForMember: v.number(),
      messages: v.array(
        v.object({
          id: v.id("supportMessages"),
          authorRole: v.string(),
          body: v.string(),
          createdAt: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const thread = await ctx.db
      .query("supportThreads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (!thread) return null

    const messages = await ctx.db
      .query("supportMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .collect()

    return {
      threadId: thread._id,
      status: thread.status,
      unreadForMember: thread.unreadForMember,
      messages: messages
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((row) => ({
          id: row._id,
          authorRole: row.authorRole,
          body: row.body,
          createdAt: row.createdAt,
        })),
    }
  },
})

/** Sends a member message to the administration support desk. */
export const sendMessage = mutation({
  args: { body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const body = args.body.trim()
    if (body.length < 2) throw new Error("Please write a message")
    if (body.length > 2000) throw new Error("Please keep messages under 2000 characters")

    const now = Date.now()
    let thread = await ctx.db
      .query("supportThreads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()

    if (!thread) {
      const threadId = await ctx.db.insert("supportThreads", {
        userId,
        status: "open",
        lastMessageAt: now,
        unreadForAdmin: 0,
        unreadForMember: 0,
      })
      thread = await ctx.db.get(threadId)
    }
    if (!thread) throw new Error("Could not open a support conversation")

    await ctx.db.insert("supportMessages", {
      threadId: thread._id,
      userId,
      authorRole: "member",
      body,
      createdAt: now,
    })
    await ctx.db.patch(thread._id, {
      status: "open",
      lastMessageAt: now,
      unreadForAdmin: thread.unreadForAdmin + 1,
    })

    const member = await memberLabel(ctx, userId)
    await ctx.db.insert("notifications", {
      kind: "support",
      title: "New support message",
      body: `${member.name}: ${body.slice(0, 120)}`,
      userId,
      threadId: thread._id,
      read: false,
      createdAt: now,
    })

    return null
  },
})

/** Clears the member's unread badge when they open the conversation. */
export const markMemberRead = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const thread = await ctx.db
      .query("supportThreads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (thread && thread.unreadForMember > 0) {
      await ctx.db.patch(thread._id, { unreadForMember: 0 })
    }
    return null
  },
})

/** Administration inbox: every member conversation with unread counts. */
export const adminThreads = query({
  args: {},
  returns: v.array(
    v.object({
      threadId: v.id("supportThreads"),
      userId: v.id("users"),
      name: v.string(),
      email: v.string(),
      status: v.string(),
      unreadForAdmin: v.number(),
      lastMessageAt: v.number(),
      lastMessage: v.string(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const threads = await ctx.db
      .query("supportThreads")
      .withIndex("by_lastMessage")
      .order("desc")
      .take(50)

    const rows: AdminThreadRow[] = []
    for (const thread of threads) {
      const member = await memberLabel(ctx, thread.userId)
      const messages = await ctx.db
        .query("supportMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect()
      const last = messages.sort((a, b) => b.createdAt - a.createdAt)[0]
      rows.push({
        threadId: thread._id,
        userId: thread.userId,
        name: member.name,
        email: member.email,
        status: thread.status,
        unreadForAdmin: thread.unreadForAdmin,
        lastMessageAt: thread.lastMessageAt,
        lastMessage: last ? `${last.authorRole === "admin" ? "You: " : ""}${last.body}` : "",
      })
    }
    return rows
  },
})

/** Messages in one conversation, for administration. */
export const adminThreadMessages = query({
  args: { threadId: v.id("supportThreads") },
  returns: v.array(
    v.object({
      id: v.id("supportMessages"),
      authorRole: v.string(),
      body: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const messages = await ctx.db
      .query("supportMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect()
    return messages
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((row) => ({
        id: row._id,
        authorRole: row.authorRole,
        body: row.body,
        createdAt: row.createdAt,
      }))
  },
})

/** Administration reply inside a member conversation. */
export const adminReply = mutation({
  args: { threadId: v.id("supportThreads"), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const body = args.body.trim()
    if (body.length < 2) throw new Error("Please write a reply")

    const thread = await ctx.db.get(args.threadId)
    if (!thread) throw new Error("That conversation no longer exists")

    const now = Date.now()
    await ctx.db.insert("supportMessages", {
      threadId: thread._id,
      userId: thread.userId,
      authorRole: "admin",
      body,
      createdAt: now,
    })
    await ctx.db.patch(thread._id, {
      status: "open",
      lastMessageAt: now,
      unreadForAdmin: 0,
      unreadForMember: thread.unreadForMember + 1,
    })
    return null
  },
})

/** Administration only: removes a single message from a conversation. */
export const adminDeleteMessage = mutation({
  args: { messageId: v.id("supportMessages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const message = await ctx.db.get(args.messageId)
    if (!message) return null

    await ctx.db.delete(message._id)

    const remaining = await ctx.db
      .query("supportMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", message.threadId))
      .collect()

    const thread = await ctx.db.get(message.threadId)
    if (thread) {
      const last = remaining.sort((a, b) => b.createdAt - a.createdAt)[0]
      await ctx.db.patch(thread._id, {
        lastMessageAt: last?.createdAt ?? thread._creationTime,
        unreadForAdmin: last?.authorRole === "member" ? Math.min(thread.unreadForAdmin, 1) : 0,
        unreadForMember: last?.authorRole === "admin" ? Math.min(thread.unreadForMember, 1) : 0,
      })
    }
    return null
  },
})
