import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "./_generated/dataModel"
import type { QueryCtx } from "./_generated/server"
import { query } from "./_generated/server"

const LIMIT = 5000

async function requireAdmin(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new Error("You need to be signed in")
  const admin = await ctx.db
    .query("admins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  if (!admin) throw new Error("This area is for administrators only")
  return userId
}

const memberRow = v.object({
  userId: v.string(),
  fullName: v.string(),
  email: v.string(),
  mobile: v.string(),
  address: v.union(v.string(), v.null()),
  referralCode: v.union(v.string(), v.null()),
  membershipLevel: v.union(v.number(), v.null()),
  accountStatus: v.union(v.string(), v.null()),
  joinedAt: v.union(v.number(), v.null()),
})

const projectRow = v.object({
  slug: v.string(),
  priceLabel: v.string(),
  updatedAt: v.number(),
})

const orderRow = v.object({
  kind: v.string(),
  reference: v.string(),
  memberName: v.string(),
  memberEmail: v.string(),
  project: v.union(v.string(), v.null()),
  amountAed: v.number(),
  status: v.string(),
  createdAt: v.number(),
})

const adminRow = v.object({
  email: v.string(),
  role: v.string(),
  createdAt: v.number(),
})

const backupShape = v.object({
  generatedAt: v.number(),
  counts: v.object({
    members: v.number(),
    projects: v.number(),
    orders: v.number(),
    administrators: v.number(),
  }),
  members: v.array(memberRow),
  projects: v.array(projectRow),
  orders: v.array(orderRow),
  administrators: v.array(adminRow),
})

/** Admin: everything needed to keep a copy of members, projects and orders. */
export const data = query({
  args: {},
  returns: backupShape,
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const [users, profiles, states, prices, admins] = await Promise.all([
      ctx.db.query("users").take(LIMIT),
      ctx.db.query("memberProfiles").take(LIMIT),
      ctx.db.query("accountStates").take(LIMIT),
      ctx.db.query("propertyPrices").take(LIMIT),
      ctx.db.query("admins").take(LIMIT),
    ])

    const profilesByUser = new Map(profiles.map((row) => [row.userId, row]))
    const statesByUser = new Map(states.map((row) => [row.userId, row]))

    const members = users
      .filter((user) => !user.isAnonymous)
      .map((user) => {
        const profile = profilesByUser.get(user._id)
        return {
          userId: user._id,
          fullName: profile?.fullName ?? user.name ?? "",
          email: user.email ?? "",
          mobile: profile?.mobile ?? "",
          address: profile?.address ?? null,
          referralCode: profile?.referralCode ?? null,
          membershipLevel: profile?.membershipLevel ?? null,
          accountStatus: statesByUser.get(user._id)?.status ?? null,
          joinedAt: user._creationTime ?? null,
        }
      })

    const projects = prices.map((row) => ({
      slug: row.slug,
      priceLabel: row.priceLabel,
      updatedAt: row.updatedAt,
    }))

    const [investments, deposits, payments, topUps] = await Promise.all([
      ctx.db.query("investmentRequests").take(LIMIT),
      ctx.db.query("reservationDeposits").take(LIMIT),
      ctx.db.query("payments").take(LIMIT),
      ctx.db.query("topUpRequests").take(LIMIT),
    ])

    const memberFor = (userId: Id<"users">) => {
      const user = users.find((row) => row._id === userId)
      const profile = profilesByUser.get(userId)
      return {
        memberName: profile?.fullName ?? user?.name ?? "",
        memberEmail: user?.email ?? "",
      }
    }

    const orders = [
      ...investments.map((row) => ({
        kind: "investment",
        reference: row._id,
        ...memberFor(row.userId),
        project: row.residence,
        amountAed: row.amountAed,
        status: row.status,
        createdAt: row.createdAt,
      })),
      ...deposits.map((row) => ({
        kind: "reservation deposit",
        reference: row._id,
        ...memberFor(row.userId),
        project: row.residence,
        amountAed: row.amountAed,
        status: "paid",
        createdAt: row.createdAt,
      })),
      ...payments.map((row) => ({
        kind: `card ${row.kind}`,
        reference: row._id,
        ...memberFor(row.userId),
        project: row.residence ?? null,
        amountAed: row.amountAed,
        status: row.status,
        createdAt: row.createdAt,
      })),
      ...topUps.map((row) => ({
        kind: "top-up",
        reference: row._id,
        ...memberFor(row.userId),
        project: row.residence ?? null,
        amountAed: row.amountAed,
        status: row.status,
        createdAt: row.createdAt,
      })),
    ].sort((a, b) => b.createdAt - a.createdAt)

    const administrators = admins
      .map((row) => ({ email: row.email, role: row.role, createdAt: row.createdAt }))
      .sort((a, b) => a.createdAt - b.createdAt)

    return {
      generatedAt: Date.now(),
      counts: {
        members: members.length,
        projects: projects.length,
        orders: orders.length,
        administrators: administrators.length,
      },
      members,
      projects,
      orders,
      administrators,
    }
  },
})
