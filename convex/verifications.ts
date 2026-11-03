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

async function memberLabel(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId)
  const profile = await ctx.db
    .query("memberProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  return {
    name: profile?.fullName ?? user?.name ?? "Member",
    email: user?.email ?? "",
  }
}

/** Latest verification on file for the signed-in member. */
export const myVerification = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      status: v.string(),
      documentName: v.string(),
      documentType: v.string(),
      documentUrl: v.union(v.null(), v.string()),
      note: v.union(v.null(), v.string()),
      reviewNote: v.union(v.null(), v.string()),
      submittedAt: v.number(),
      reviewedAt: v.union(v.null(), v.number()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const rows = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    const latest = rows.sort((a, b) => b.submittedAt - a.submittedAt)[0]
    if (!latest) return null

    return {
      status: latest.status,
      documentName: latest.documentName,
      documentType: latest.documentType,
      documentUrl: await ctx.storage.getUrl(latest.documentId),
      note: latest.note ?? null,
      reviewNote: latest.reviewNote ?? null,
      submittedAt: latest.submittedAt,
      reviewedAt: latest.reviewedAt ?? null,
    }
  },
})

/** Upload target for an identity document. */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireUser(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

/** Member submits a government identity document for approval. */
export const submitVerification = mutation({
  args: {
    documentId: v.id("_storage"),
    documentName: v.string(),
    documentType: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const documentName = args.documentName.trim()
    const documentType = args.documentType.trim()
    if (documentName.length < 3) throw new ConvexError("Attach a photo or PDF of your document")
    if (documentType.length < 3) throw new ConvexError("Choose the document type")

    const existing = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()

    const approved = existing.find((row) => row.status === "approved")
    if (approved) throw new ConvexError("Your identity is already verified")

    const now = Date.now()
    await ctx.db.insert("verifications", {
      userId,
      status: "pending",
      documentId: args.documentId,
      documentName: documentName.slice(0, 120),
      documentType: documentType.slice(0, 60),
      note: args.note?.trim().slice(0, 300) || undefined,
      submittedAt: now,
    })

    const member = await memberLabel(ctx, userId)
    await ctx.db.insert("notifications", {
      kind: "verification",
      title: "New identity document",
      body: `${member.name} submitted ${documentType} for approval`,
      userId,
      read: false,
      createdAt: now,
    })
    return null
  },
})

/** Administration: documents waiting for a decision, newest first. */
export const adminVerifications = query({
  args: {},
  returns: v.array(
    v.object({
      verificationId: v.id("verifications"),
      userId: v.id("users"),
      name: v.string(),
      email: v.string(),
      status: v.string(),
      documentName: v.string(),
      documentType: v.string(),
      documentUrl: v.union(v.null(), v.string()),
      note: v.union(v.null(), v.string()),
      submittedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const rows = await ctx.db
      .query("verifications")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect()

    const result: Array<{
      verificationId: Id<"verifications">
      userId: Id<"users">
      name: string
      email: string
      status: string
      documentName: string
      documentType: string
      documentUrl: string | null
      note: string | null
      submittedAt: number
    }> = []
    for (const row of rows.sort((a, b) => b.submittedAt - a.submittedAt)) {
      const member = await memberLabel(ctx, row.userId)
      result.push({
        verificationId: row._id,
        userId: row.userId,
        name: member.name,
        email: member.email,
        status: row.status,
        documentName: row.documentName,
        documentType: row.documentType,
        documentUrl: await ctx.storage.getUrl(row.documentId),
        note: row.note ?? null,
        submittedAt: row.submittedAt,
      })
    }
    return result
  },
})

/** Administration: approve or reject an identity document. */
export const decideVerification = mutation({
  args: {
    verificationId: v.id("verifications"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    reviewNote: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx)
    const row = await ctx.db.get(args.verificationId)
    if (!row) throw new ConvexError("That document is no longer available")

    const now = Date.now()
    await ctx.db.patch(row._id, {
      status: args.decision,
      reviewedAt: now,
      reviewedBy: adminId,
      reviewNote: args.reviewNote?.trim().slice(0, 300) || undefined,
    })

    await ctx.db.insert("notifications", {
      kind: "verification",
      title: args.decision === "approved" ? "Identity approved" : "Identity not approved",
      body:
        args.decision === "approved"
          ? "Your identity document was approved. You can now make payments."
          : `Your identity document was not approved.${
              args.reviewNote?.trim() ? ` ${args.reviewNote.trim()}` : " Please submit a clearer copy."
            }`,
      userId: row.userId,
      read: false,
      createdAt: now,
    })
    return null
  },
})

/** True when the member has an approved identity document. */
export async function isVerified(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("verifications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()
  return rows.some((row) => row.status === "approved")
}
