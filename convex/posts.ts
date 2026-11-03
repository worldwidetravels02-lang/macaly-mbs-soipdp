import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"

/** Turns any headline into a URL-friendly slug. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
}

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new Error("You need to be signed in")
  const admin = await ctx.db
    .query("admins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
  if (!admin) throw new Error("This area is for administrators only")
  return userId
}

/** Public: every published article, newest first. */
export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .order("desc")
      .take(100)

    return posts.map((post) => ({
      _id: post._id,
      title: post.title,
      slug: post.slug,
      category: post.category,
      excerpt: post.excerpt,
      coverImage: post.coverImage ?? null,
      authorName: post.authorName,
      publishedAt: post.publishedAt ?? post.createdAt,
    }))
  },
})

/** Public: one published article by slug. */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const slug = args.slug.trim().toLowerCase()
    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first()

    if (!post || !post.published) return null

    return {
      _id: post._id,
      title: post.title,
      slug: post.slug,
      category: post.category,
      excerpt: post.excerpt,
      content: post.content,
      coverImage: post.coverImage ?? null,
      authorName: post.authorName,
      publishedAt: post.publishedAt ?? post.createdAt,
      updatedAt: post.updatedAt,
    }
  },
})

const neighbour = v.union(
  v.object({ title: v.string(), slug: v.string() }),
  v.null(),
)

/** Public: the article published just before and just after this one. */
export const getAdjacent = query({
  args: { slug: v.string() },
  returns: v.object({ previous: neighbour, next: neighbour }),
  handler: async (ctx, args) => {
    const slug = args.slug.trim().toLowerCase()
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .order("desc")
      .take(100)

    const index = posts.findIndex((post) => post.slug === slug)
    if (index === -1) return { previous: null, next: null }

    const toLink = (post: (typeof posts)[number] | undefined) =>
      post ? { title: post.title, slug: post.slug } : null

    return {
      previous: toLink(posts[index - 1]),
      next: toLink(posts[index + 1]),
    }
  },
})

/** Admin: drafts and published articles together. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const posts = await ctx.db.query("posts").order("desc").take(200)
    return posts.map((post) => ({
      _id: post._id,
      title: post.title,
      slug: post.slug,
      category: post.category,
      excerpt: post.excerpt,
      content: post.content,
      coverImage: post.coverImage ?? null,
      authorName: post.authorName,
      published: post.published,
      publishedAt: post.publishedAt ?? null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }))
  },
})

const articleFields = {
  title: v.string(),
  slug: v.optional(v.string()),
  category: v.string(),
  excerpt: v.string(),
  content: v.string(),
  coverImage: v.optional(v.string()),
  authorName: v.string(),
  published: v.boolean(),
}

type ArticleInput = {
  title: string
  slug?: string
  category: string
  excerpt: string
  content: string
  coverImage?: string
  authorName: string
  published: boolean
}

async function cleanArticle(ctx: QueryCtx | MutationCtx, input: ArticleInput, ignoreId?: Id<"posts">) {
  const title = input.title.trim()
  const content = input.content.trim()
  if (title.length < 3) throw new Error("Give the article a title of at least 3 characters")
  if (content.length < 20) throw new Error("Write at least a short paragraph before saving")

  const slug = slugify(input.slug?.trim() ? input.slug : title) || slugify(title)
  if (!slug) throw new Error("The title needs a few letters or numbers to build a link")

  const existing = await ctx.db
    .query("posts")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first()
  if (existing && existing._id !== ignoreId) {
    throw new Error("Another article already uses that link. Choose a different link.")
  }

  return {
    title,
    slug,
    category: input.category.trim() || "Journal",
    excerpt: input.excerpt.trim() || content.slice(0, 180).trim(),
    content,
    coverImage: input.coverImage?.trim() ? input.coverImage.trim() : undefined,
    authorName: input.authorName.trim() || "Editorial desk",
    published: input.published,
  }
}

/** Admin: write a new article. */
export const create = mutation({
  args: articleFields,
  returns: v.id("posts"),
  handler: async (ctx, args) => {
    const userId = await requireAdmin(ctx)
    const clean = await cleanArticle(ctx, args)
    const now = Date.now()

    return await ctx.db.insert("posts", {
      ...clean,
      publishedAt: clean.published ? now : undefined,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    })
  },
})

/** Admin: edit an existing article. */
export const update = mutation({
  args: { id: v.id("posts"), ...articleFields },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAdmin(ctx)
    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error("That article no longer exists")

    const clean = await cleanArticle(ctx, args, args.id)
    const wasPublished = existing.published
    const publishedAt =
      clean.published && !wasPublished
        ? Date.now()
        : clean.published
          ? (existing.publishedAt ?? Date.now())
          : existing.publishedAt

    await ctx.db.patch(args.id, {
      ...clean,
      publishedAt,
      updatedAt: Date.now(),
      updatedBy: userId,
    })
    return null
  },
})

/** Admin: delete an article. */
export const remove = mutation({
  args: { id: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error("That article no longer exists")
    await ctx.db.delete(args.id)
    return null
  },
})
