import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"])

async function setup() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const adminUserId = await ctx.db.insert("users", { email: "owner@example.com" })
    await ctx.db.insert("admins", {
      userId: adminUserId,
      email: "owner@example.com",
      role: "owner",
      createdAt: Date.now(),
    })
    return { adminUserId }
  })
  return { t, admin: t.withIdentity({ subject: `${ids.adminUserId}|test-session` }) }
}

const draft = {
  title: "Palm Jumeirah buying guide",
  category: "Market notes",
  excerpt: "What to check before you reserve.",
  content: "A short opening paragraph about the island.\n\n## What to check\n\n- Title deed\n- Service charges",
  authorName: "Editorial desk",
  published: false,
}

describe("journal posts", () => {
  test("requires an administrator to write", async () => {
    const { t } = await setup()
    await expect(t.mutation(api.posts.create, draft)).rejects.toThrow(/signed in/i)
    await expect(t.query(api.posts.listAll, {})).rejects.toThrow(/signed in/i)
  })

  test("keeps drafts private until published", async () => {
    const { t, admin } = await setup()
    const id = await admin.mutation(api.posts.create, draft)

    expect(await t.query(api.posts.listPublished, {})).toEqual([])
    expect(await t.query(api.posts.getBySlug, { slug: "palm-jumeirah-buying-guide" })).toBeNull()

    await admin.mutation(api.posts.update, {
      id,
      ...draft,
      published: true,
    })

    const published = await t.query(api.posts.listPublished, {})
    expect(published).toHaveLength(1)
    expect(published[0].title).toBe(draft.title)

    const article = await t.query(api.posts.getBySlug, { slug: "palm-jumeirah-buying-guide" })
    expect(article?.content).toContain("## What to check")
    expect(article?.authorName).toBe("Editorial desk")
  })

  test("rejects duplicate links and short content", async () => {
    const { admin } = await setup()
    await admin.mutation(api.posts.create, draft)

    await expect(
      admin.mutation(api.posts.create, {
        ...draft,
        title: "Another piece",
        slug: "palm-jumeirah-buying-guide",
      }),
    ).rejects.toThrow(/already uses that link/i)
    await expect(
      admin.mutation(api.posts.create, { ...draft, title: "Too short", content: "tiny" }),
    ).rejects.toThrow(/short paragraph/i)
  })

  test("links the previous and next published article", async () => {
    const { t, admin } = await setup()
    const older = await admin.mutation(api.posts.create, { ...draft, title: "Older", published: true })
    const middle = await admin.mutation(api.posts.create, { ...draft, title: "Middle", published: true })
    const newer = await admin.mutation(api.posts.create, { ...draft, title: "Newer", published: true })

    await t.run(async (ctx) => {
      await ctx.db.patch(older, { publishedAt: Date.UTC(2026, 0, 1) })
      await ctx.db.patch(middle, { publishedAt: Date.UTC(2026, 1, 1) })
      await ctx.db.patch(newer, { publishedAt: Date.UTC(2026, 2, 1) })
    })

    const middleLinks = await t.query(api.posts.getAdjacent, { slug: "middle" })
    expect(middleLinks.previous?.title).toBe("Newer")
    expect(middleLinks.next?.title).toBe("Older")

    const newest = await t.query(api.posts.listPublished, {})
    expect(newest[0].title).toBe("Newer")

    const first = await t.query(api.posts.getAdjacent, { slug: newest[0].slug })
    expect(first.previous).toBeNull()
    expect(first.next?.title).toBe("Middle")

    const missing = await t.query(api.posts.getAdjacent, { slug: "not-an-article" })
    expect(missing).toEqual({ previous: null, next: null })
  })

  test("edits and deletes an article", async () => {
    const { t, admin } = await setup()
    const id: Id<"posts"> = await admin.mutation(api.posts.create, { ...draft, published: true })

    await admin.mutation(api.posts.update, {
      id,
      ...draft,
      title: "Palm Jumeirah guide, updated",
      slug: "palm-guide-updated",
      published: true,
    })

    const all = await admin.query(api.posts.listAll, {})
    expect(all).toHaveLength(1)
    expect(all[0].slug).toBe("palm-guide-updated")

    await admin.mutation(api.posts.remove, { id })
    expect(await t.query(api.posts.listPublished, {})).toEqual([])
  })
})
