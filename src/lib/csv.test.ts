import { describe, expect, test } from "vitest"
import { membersToCsv, ordersToCsv, projectsToCsv } from "./csv"

const order = {
  kind: "investment",
  reference: "abc123",
  memberName: "Layla Haddad",
  memberEmail: "layla@example.com",
  project: "palm-jumeirah",
  amountAed: 50000,
  status: "pending",
  createdAt: Date.UTC(2026, 10, 2, 9, 30, 0),
}

describe("ordersToCsv", () => {
  test("writes a header row and one row per order", () => {
    const csv = ordersToCsv([order])
    const lines = csv.trimEnd().split("\r\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('Kind,Reference,Member,Email,Project,Amount (AED),Status,Created')
    expect(lines[1]).toBe(
      "investment,abc123,Layla Haddad,layla@example.com,palm-jumeirah,50000,pending,2026-11-02 09:30:00",
    )
  })

  test("quotes values that contain commas or quotes", () => {
    const csv = ordersToCsv([{ ...order, memberName: 'Haddad, "Layla"' }])
    expect(csv).toContain('"Haddad, ""Layla"""')
  })

  test("leaves missing projects empty and handles an empty list", () => {
    expect(ordersToCsv([{ ...order, project: null }])).toContain("layla@example.com,,50000")
    expect(ordersToCsv([]).trimEnd().split("\r\n")).toHaveLength(1)
  })
})

describe("membersToCsv", () => {
  test("writes name, phone, level and status", () => {
    const csv = membersToCsv([
      { fullName: "Layla Haddad", mobile: "+971500000000", membershipLevel: 2, accountStatus: "active" },
    ])
    expect(csv.trimEnd().split("\r\n")).toEqual([
      "Name,Phone,Level,Status",
      "Layla Haddad,+971500000000,2,active",
    ])
  })

  test("leaves unknown level and status blank and quotes commas", () => {
    const csv = membersToCsv([
      { fullName: "Haddad, Layla", mobile: "", membershipLevel: null, accountStatus: null },
    ])
    expect(csv).toContain('"Haddad, Layla",,,')
  })
})

describe("projectsToCsv", () => {
  test("writes slug, price and last update", () => {
    const csv = projectsToCsv([
      { slug: "palm-jumeirah", priceLabel: "From AED 18.5M", updatedAt: Date.UTC(2026, 10, 2, 9, 30, 0) },
    ])
    expect(csv.trimEnd().split("\r\n")).toEqual([
      "Slug,Price,Last update",
      "palm-jumeirah,From AED 18.5M,2026-11-02 09:30:00",
    ])
  })
})
