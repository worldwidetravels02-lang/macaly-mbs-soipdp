import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { authTables } from "@convex-dev/auth/server"

export const transactionType = v.union(
  v.literal("bonus"),
  v.literal("topup"),
  v.literal("withdrawal"),
  v.literal("adjustment"),
  v.literal("profit"),
)

export const transactionStatus = v.union(
  v.literal("completed"),
  v.literal("pending"),
  v.literal("rejected"),
)

export const requestStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
)

export default defineSchema({
  ...authTables,

  /** Extra member details collected at registration. */
  memberProfiles: defineTable({
    userId: v.id("users"),
    fullName: v.string(),
    mobile: v.string(),
    address: v.optional(v.string()),
    referralCode: v.optional(v.string()),
    interest: v.optional(v.string()),
    membershipLevel: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  /** Tasks administration assigns to unlock a membership level. */
  memberTasks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    detail: v.optional(v.string()),
    targetLevel: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    createdAt: v.number(),
    submittedAt: v.optional(v.number()),
    reviewedAt: v.optional(v.number()),
    reviewNote: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  /** Site-visit and brochure enquiries submitted from the website. */
  enquiries: defineTable({
    name: v.string(),
    mobile: v.string(),
    email: v.optional(v.string()),
    residence: v.string(),
    message: v.optional(v.string()),
    source: v.string(),
  }).index("by_residence", ["residence"]),

  /** One investment wallet per member. */
  wallets: defineTable({
    userId: v.id("users"),
    investmentOption: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Wallet ledger. Balance is always derived from completed entries. */
  walletTransactions: defineTable({
    userId: v.id("users"),
    type: transactionType,
    amountAed: v.number(),
    status: transactionStatus,
    note: v.optional(v.string()),
    residence: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.optional(v.id("users")),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  /** Top-up requests recorded by the member and approved by administration. */
  topUpRequests: defineTable({
    userId: v.id("users"),
    amountAed: v.number(),
    method: v.string(),
    reference: v.optional(v.string()),
    residence: v.optional(v.string()),
    status: requestStatus,
    createdAt: v.number(),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  /** Bank and crypto details shown to members. Administration only writes. */
  paymentDetails: defineTable({
    bankName: v.string(),
    accountName: v.string(),
    accountNumber: v.string(),
    iban: v.string(),
    swift: v.string(),
    note: v.string(),
    crypto: v.array(
      v.object({
        coin: v.string(),
        network: v.string(),
        address: v.string(),
      }),
    ),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  }),

  /** Crypto payments sent by members with an uploaded payment slip. */
  cryptoPayments: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("topup"), v.literal("deposit"), v.literal("investment")),
    residence: v.optional(v.string()),
    amountAed: v.number(),
    coin: v.string(),
    network: v.string(),
    address: v.string(),
    txHash: v.optional(v.string()),
    proofId: v.id("_storage"),
    proofName: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    note: v.optional(v.string()),
    createdAt: v.number(),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  /** Monthly profit payouts credited to member wallets. */
  profitPayouts: defineTable({
    userId: v.id("users"),
    periodKey: v.string(),
    planCode: v.string(),
    planName: v.string(),
    level: v.number(),
    percent: v.number(),
    basisAed: v.number(),
    amountAed: v.number(),
    note: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.optional(v.id("users")),
    walletTransactionId: v.optional(v.id("walletTransactions")),
  })
    .index("by_user", ["userId"])
    .index("by_period", ["periodKey"])
    .index("by_user_and_period", ["userId", "periodKey"]),

  /** Membership plans edited by administration only. */
  membershipPlans: defineTable({
    code: v.string(),
    level: v.number(),
    name: v.string(),
    minAed: v.number(),
    profitPercent: v.number(),
    commissionPercent: v.number(),
    active: v.boolean(),
    updatedAt: v.number(),
  }).index("by_code", ["code"]),

  /** Investment requests raised by a member and approved by administration. */
  investmentRequests: defineTable({
    userId: v.id("users"),
    residence: v.string(),
    rankCode: v.string(),
    amountAed: v.number(),
    profitAed: v.optional(v.number()),
    commissionAed: v.optional(v.number()),
    note: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("funded"),
    ),
    createdAt: v.number(),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
    fundedAt: v.optional(v.number()),
    walletTransactionId: v.optional(v.id("walletTransactions")),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  /** Withdrawal requests raised by the member and released by administration. */
  withdrawalRequests: defineTable({
    userId: v.id("users"),
    amountAed: v.number(),
    iban: v.string(),
    status: requestStatus,
    createdAt: v.number(),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  /** Identity documents submitted by members before their first payment. */
  verifications: defineTable({
    userId: v.id("users"),
    status: requestStatus,
    documentId: v.id("_storage"),
    documentName: v.string(),
    documentType: v.string(),
    note: v.optional(v.string()),
    submittedAt: v.number(),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
    reviewNote: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  /** Offers and promotions published by administration for a listing. */
  promotions: defineTable({
    slug: v.string(),
    title: v.string(),
    detail: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  })
    .index("by_slug", ["slug"])
    .index("by_active", ["active"]),

  /** Administration standing for each member: active, frozen or blocked. */
  accountStates: defineTable({
    userId: v.id("users"),
    status: v.union(v.literal("active"), v.literal("frozen"), v.literal("blocked")),
    reason: v.optional(v.string()),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  }).index("by_user", ["userId"]),

  /** Administration accounts. The first member to claim becomes the owner. */
  admins: defineTable({
    userId: v.id("users"),
    email: v.string(),
    role: v.union(v.literal("owner"), v.literal("admin")),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Private administration settings, such as the panel passcode hash. */
  adminSettings: defineTable({
    key: v.string(),
    passcodeHash: v.string(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  }).index("by_key", ["key"]),

  /** Alerts shown to administration (new top-ups, withdrawals, support messages). */
  notifications: defineTable({
    kind: v.union(
      v.literal("topup"),
      v.literal("withdrawal"),
      v.literal("support"),
      v.literal("verification"),
      v.literal("deposit"),
      v.literal("investment"),
    ),
    title: v.string(),
    body: v.string(),
    userId: v.optional(v.id("users")),
    threadId: v.optional(v.id("supportThreads")),
    read: v.boolean(),
    createdAt: v.number(),
  }).index("by_read", ["read"]),

  /** Listing prices maintained by administration. */
  propertyPrices: defineTable({
    slug: v.string(),
    priceLabel: v.string(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  }).index("by_slug", ["slug"]),

  /** One support conversation per member, answered by administration. */
  supportThreads: defineTable({
    userId: v.id("users"),
    status: v.union(v.literal("open"), v.literal("closed")),
    lastMessageAt: v.number(),
    unreadForAdmin: v.number(),
    unreadForMember: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_lastMessage", ["lastMessageAt"]),

  /** Messages inside a support conversation. */
  supportMessages: defineTable({
    threadId: v.id("supportThreads"),
    userId: v.id("users"),
    authorRole: v.union(v.literal("member"), v.literal("admin")),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_thread", ["threadId"]),

  /** Exchange rates used to price card payments in AED, USD and INR. */
  fxRates: defineTable({
    code: v.string(),
    label: v.string(),
    aedPerUnit: v.number(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  }).index("by_code", ["code"]),

  /** Card payments created at checkout and confirmed by the payment webhook. */
  payments: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("topup"), v.literal("deposit")),
    amountAed: v.number(),
    amountCharged: v.number(),
    currency: v.string(),
    aedPerUnit: v.number(),
    residence: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("expired")),
    sessionId: v.optional(v.string()),
    createdAt: v.number(),
    paidAt: v.optional(v.number()),
    mode: v.union(v.literal("test"), v.literal("live")),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"])
    .index("by_mode", ["mode"])
    .index("by_user_and_mode", ["userId", "mode"]),

  /** Journal articles written by administration and shown on the public site. */
  posts: defineTable({
    title: v.string(),
    slug: v.string(),
    category: v.string(),
    excerpt: v.string(),
    content: v.string(),
    coverImage: v.optional(v.string()),
    authorName: v.string(),
    published: v.boolean(),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  })
    .index("by_slug", ["slug"])
    .index("by_published", ["published", "publishedAt"]),

  /** Reservation deposits paid by card against a residence. */
  reservationDeposits: defineTable({
    userId: v.id("users"),
    residence: v.string(),
    amountAed: v.number(),
    amountCharged: v.number(),
    currency: v.string(),
    paymentId: v.id("payments"),
    createdAt: v.number(),
    mode: v.union(v.literal("test"), v.literal("live")),
  })
    .index("by_user", ["userId"])
    .index("by_mode", ["mode"])
    .index("by_user_and_mode", ["userId", "mode"]),
})
