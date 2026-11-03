import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"])

async function setup() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { email: "owner@example.com", name: "Owner" })
    await ctx.db.insert("admins", {
      userId: ownerId,
      email: "owner@example.com",
      role: "owner",
      createdAt: Date.now(),
    })

    const memberId = await ctx.db.insert("users", { email: "member@example.com" })
    await ctx.db.insert("memberProfiles", {
      userId: memberId,
      fullName: "Layla Haddad",
      mobile: "+971500000000",
      membershipLevel: 2,
    })
    await ctx.db.insert("accountStates", {
      userId: memberId,
      status: "active",
      updatedAt: Date.now(),
    })
    await ctx.db.insert("propertyPrices", {
      slug: "palm-jumeirah",
      priceLabel: "From AED 18.5M",
      updatedAt: Date.now(),
    })
    await ctx.db.insert("investmentRequests", {
      userId: memberId,
      residence: "palm-jumeirah",
      rankCode: "level-2",
      amountAed: 50000,
      status: "pending",
      createdAt: Date.now(),
    })
    await ctx.db.insert("reservationDeposits", {
      userId: memberId,
      residence: "palm-jumeirah",
      amountAed: 25000,
      amountCharged: 25000,
      currency: "AED",
      paymentId: await ctx.db.insert("payments", {
        userId: memberId,
        kind: "deposit",
        amountAed: 25000,
        amountCharged: 25000,
        currency: "AED",
        aedPerUnit: 1,
        status: "paid",
        createdAt: Date.now(),
        mode: "test",
      }),
      createdAt: Date.now(),
      mode: "test",
    })

    return { ownerId, memberId }
  })

  return { t, admin: t.withIdentity({ subject: `${ids.ownerId}|test-session` }) }
}

describe("data backup", () => {
  test("is refused for anyone who is not an administrator", async () => {
    const { t } = await setup()
    await expect(t.query(api.backup.data, {})).rejects.toThrow(/signed in/i)
  })

  test("returns members, projects and orders with counts", async () => {
    const { admin } = await setup()
    const backup = await admin.query(api.backup.data, {})

    expect(backup.counts.members).toBe(2)
    expect(backup.members.map((row) => row.email).sort()).toEqual([
      "member@example.com",
      "owner@example.com",
    ])

    const member = backup.members.find((row) => row.email === "member@example.com")
    expect(member?.fullName).toBe("Layla Haddad")
    expect(member?.accountStatus).toBe("active")
    expect(member?.membershipLevel).toBe(2)

    expect(backup.projects).toEqual([
      expect.objectContaining({ slug: "palm-jumeirah", priceLabel: "From AED 18.5M" }),
    ])

    expect(backup.counts.orders).toBe(3)
    const kinds = backup.orders.map((row) => row.kind).sort()
    expect(kinds).toEqual(["card deposit", "investment", "reservation deposit"])
    expect(backup.orders.every((row) => row.memberEmail === "member@example.com")).toBe(true)
    expect(backup.orders.some((row) => row.project === "palm-jumeirah")).toBe(true)
    expect(backup.generatedAt).toBeGreaterThan(0)

    expect(backup.counts.administrators).toBe(1)
    expect(backup.administrators).toEqual([
      expect.objectContaining({ email: "owner@example.com", role: "owner" }),
    ])
  })
})
