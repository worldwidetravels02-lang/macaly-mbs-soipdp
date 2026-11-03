import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Id } from '@/convex/_generated/dataModel'
import { api } from '@/convex/_generated/api'
import { errorMessage } from '../lib/errors'
import { formatDate } from '../lib/format'
import { buildWxr } from '../lib/wxr'
import { ArrowRight } from './site-chrome'

type Draft = {
  title: string
  slug: string
  category: string
  excerpt: string
  coverImage: string
  authorName: string
  content: string
  published: boolean
}

const EMPTY_DRAFT: Draft = {
  title: '',
  slug: '',
  category: 'Market notes',
  excerpt: '',
  coverImage: '',
  authorName: 'Msheireb editorial desk',
  content: '',
  published: false,
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

/** Journal editor used inside the administration dashboard. */
export function JournalEditor() {
  const posts = useQuery(api.posts.listAll, {})
  const createPost = useMutation(api.posts.create)
  const updatePost = useMutation(api.posts.update)
  const removePost = useMutation(api.posts.remove)

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<Id<'posts'> | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<Id<'posts'> | null>(null)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const startNew = () => {
    setDraft(EMPTY_DRAFT)
    setEditingId(null)
    setSlugTouched(false)
    setFormOpen(true)
    setError(null)
    setNotice(null)
  }

  const startEdit = (post: {
    _id: Id<'posts'>
    title: string
    slug: string
    category: string
    excerpt: string
    content: string
    coverImage: string | null
    authorName: string
    published: boolean
  }) => {
    setDraft({
      title: post.title,
      slug: post.slug,
      category: post.category,
      excerpt: post.excerpt,
      coverImage: post.coverImage ?? '',
      authorName: post.authorName,
      content: post.content,
      published: post.published,
    })
    setEditingId(post._id)
    setSlugTouched(true)
    setFormOpen(true)
    setError(null)
    setNotice(null)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setSlugTouched(false)
    setError(null)
  }

  const setTitle = (title: string) => {
    setDraft((current) => ({
      ...current,
      title,
      slug: slugTouched ? current.slug : slugify(title),
    }))
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)

    const payload = {
      title: draft.title,
      slug: draft.slug.trim() ? draft.slug : undefined,
      category: draft.category,
      excerpt: draft.excerpt,
      content: draft.content,
      coverImage: draft.coverImage.trim() ? draft.coverImage.trim() : undefined,
      authorName: draft.authorName,
      published: draft.published,
    }

    try {
      if (editingId) {
        await updatePost({ id: editingId, ...payload })
        setNotice(draft.published ? 'Article updated and live in the journal.' : 'Draft updated.')
      } else {
        await createPost(payload)
        setNotice(draft.published ? 'Article published to the journal.' : 'Draft saved.')
      }
      closeForm()
    } catch (err) {
      setError(errorMessage(err, 'Could not save this article. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const exportForWordpress = () => {
    if (!posts || posts.length === 0) return
    setError(null)

    try {
      const xml = buildWxr(posts, {
        title: 'Msheireb Properties Journal',
        url: window.location.origin,
        description: 'Journal articles exported from the administration area.',
      })
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `wordpress-journal-${new Date().toISOString().slice(0, 10)}.xml`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setNotice(
        `Exported ${posts.length} article${posts.length === 1 ? '' : 's'} for WordPress. In WordPress open Tools → Import → WordPress, install the importer, then upload the file.`,
      )
    } catch (err) {
      setError(errorMessage(err, 'Could not build the WordPress export file.'))
    }
  }

  const remove = async (id: Id<'posts'>) => {    setError(null)
    try {
      await removePost({ id })
      setConfirmId(null)
      if (editingId === id) closeForm()
      setNotice('Article deleted.')
    } catch (err) {
      setError(errorMessage(err, 'Could not delete this article.'))
    }
  }

  return (
    <div data-testid="admin-journal" data-state={posts === undefined ? 'loading' : 'ready'} className="grid gap-6">
      <div className="flex flex-col gap-4 border border-border bg-card px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow text-[0.5rem] text-brass">Journal</p>
          <h2 className="display mt-2 text-xl">Write and publish articles</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Published articles appear on the public journal at <code>/journal</code>. Drafts stay
            private until you tick “Published”.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/journal"
            className="eyebrow inline-flex items-center gap-2 border border-border px-5 py-3 text-[0.5rem] transition-colors hover:border-brass"
          >
            View journal
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={exportForWordpress}
            disabled={!posts || posts.length === 0}
            data-testid="admin-blog-export"
            className="eyebrow inline-flex items-center gap-2 border border-border px-5 py-3 text-[0.5rem] transition-colors hover:border-brass disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export for WordPress
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={startNew}
            data-testid="admin-blog-new"
            className="eyebrow inline-flex items-center gap-2 bg-primary px-5 py-3 text-[0.5rem] text-primary-foreground transition-colors hover:bg-ink/85"
          >
            New article
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" data-testid="admin-blog-error" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p data-testid="admin-blog-notice" className="border border-brass/40 bg-brass/5 px-4 py-3 text-sm text-ink-soft">
          {notice}
        </p>
      ) : null}

      {formOpen ? (
        <form onSubmit={save} data-testid="admin-blog-form" className="border border-border bg-card">
          <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
            <h3 className="display text-lg">{editingId ? 'Edit article' : 'New article'}</h3>
            <button
              type="button"
              onClick={closeForm}
              className="eyebrow text-[0.5rem] text-ink-soft transition-colors hover:text-brass"
            >
              Close
            </button>
          </div>

          <div className="grid gap-5 px-6 py-6">
            <label className="grid gap-2 text-sm">
              <span className="eyebrow text-[0.5rem] text-ink-soft">Title</span>
              <input
                value={draft.title}
                onChange={(event) => setTitle(event.target.value)}
                required
                minLength={3}
                data-testid="admin-blog-title"
                placeholder="Six things to know before buying on Palm Jumeirah"
                className="border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brass"
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className="eyebrow text-[0.5rem] text-ink-soft">Link (slug)</span>
                <input
                  value={draft.slug}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, slug: event.target.value }))
                    setSlugTouched(true)
                  }}
                  data-testid="admin-blog-slug"
                  placeholder="palm-jumeirah-buying-guide"
                  className="border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brass"
                />
                <span className="text-xs text-ink-soft">
                  Public address: /journal/{draft.slug || 'your-link'}
                </span>
              </label>

              <label className="grid gap-2 text-sm">
                <span className="eyebrow text-[0.5rem] text-ink-soft">Category</span>
                <input
                  value={draft.category}
                  onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                  data-testid="admin-blog-category"
                  placeholder="Market notes"
                  className="border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brass"
                />
              </label>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className="eyebrow text-[0.5rem] text-ink-soft">Author name</span>
                <input
                  value={draft.authorName}
                  onChange={(event) => setDraft((current) => ({ ...current, authorName: event.target.value }))}
                  data-testid="admin-blog-author"
                  className="border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brass"
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span className="eyebrow text-[0.5rem] text-ink-soft">Cover image link (optional)</span>
                <input
                  value={draft.coverImage}
                  onChange={(event) => setDraft((current) => ({ ...current, coverImage: event.target.value }))}
                  data-testid="admin-blog-cover"
                  placeholder="https://…"
                  className="border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brass"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm">
              <span className="eyebrow text-[0.5rem] text-ink-soft">Summary</span>
              <textarea
                value={draft.excerpt}
                onChange={(event) => setDraft((current) => ({ ...current, excerpt: event.target.value }))}
                rows={2}
                data-testid="admin-blog-excerpt"
                placeholder="One or two sentences shown on the journal page."
                className="border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brass"
              />
              <span className="text-xs text-ink-soft">Left empty, the first lines of the article are used.</span>
            </label>

            <label className="grid gap-2 text-sm">
              <span className="eyebrow text-[0.5rem] text-ink-soft">Article</span>
              <textarea
                value={draft.content}
                onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                rows={14}
                required
                data-testid="admin-blog-content"
                placeholder={'Write a paragraph, leave a blank line, then the next one.\n\n## A heading\n\n- A bullet\n- Another bullet'}
                className="border border-border bg-background px-4 py-3 font-mono text-sm leading-relaxed outline-none focus:border-brass"
              />
              <span className="text-xs text-ink-soft">
                Blank lines start a new paragraph. Start a line with “## ” for a heading, or “- ” for
                a list.
              </span>
            </label>

            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(event) => setDraft((current) => ({ ...current, published: event.target.checked }))}
                data-testid="admin-blog-published"
                className="h-4 w-4 accent-brass"
              />
              <span>Published (visible on the public journal)</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-border px-6 py-4">
            <button
              type="submit"
              disabled={saving}
              data-testid="admin-blog-save"
              className="eyebrow bg-primary px-6 py-3 text-[0.5rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save article'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="eyebrow border border-border px-6 py-3 text-[0.5rem] transition-colors hover:border-brass"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <section className="border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <h3 className="display text-lg">Articles</h3>
          <span className="eyebrow text-[0.5rem] text-ink-soft">
            {posts === undefined ? 'Loading' : `${posts.length} total`}
          </span>
        </div>

        {posts === undefined ? (
          <p className="px-6 py-6 text-sm text-ink-soft">Loading articles…</p>
        ) : posts.length === 0 ? (
          <div data-testid="admin-blog-empty" className="px-6 py-10 text-center">
            <p className="text-sm text-ink-soft">No articles yet. Write the first one.</p>
            <button
              type="button"
              onClick={startNew}
              className="eyebrow mt-5 bg-primary px-5 py-3 text-[0.5rem] text-primary-foreground transition-colors hover:bg-ink/85"
            >
              New article
            </button>
          </div>
        ) : (
          <div data-testid="admin-blog-list" className="divide-y divide-border">
            {posts.map((post) => (
              <div
                key={post._id}
                data-testid={`admin-blog-post-${post._id}`}
                className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{post.title}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    /journal/{post.slug} · {post.category} ·{' '}
                    {post.published
                      ? `Published ${formatDate(post.publishedAt ?? post.createdAt)}`
                      : 'Draft'}{' '}
                    · updated {formatDate(post.updatedAt)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {post.published ? (
                    <Link
                      to="/journal/$slug"
                      params={{ slug: post.slug }}
                      className="eyebrow border border-border px-4 py-2.5 text-[0.5rem] transition-colors hover:border-brass"
                    >
                      View
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => startEdit(post)}
                    data-testid={`admin-blog-edit-${post._id}`}
                    className="eyebrow border border-border px-4 py-2.5 text-[0.5rem] transition-colors hover:border-brass"
                  >
                    Edit
                  </button>
                  {confirmId === post._id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => remove(post._id)}
                        data-testid={`admin-blog-confirm-delete-${post._id}`}
                        className="eyebrow border border-destructive/50 px-4 py-2.5 text-[0.5rem] text-destructive transition-colors hover:bg-destructive/10"
                      >
                        Delete for good
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="eyebrow px-4 py-2.5 text-[0.5rem] text-ink-soft transition-colors hover:text-ink"
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(post._id)}
                      data-testid={`admin-blog-delete-${post._id}`}
                      className="eyebrow border border-border px-4 py-2.5 text-[0.5rem] text-ink-soft transition-colors hover:border-destructive/50 hover:text-destructive"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
