export type WxrPost = {
  _id: string
  title: string
  slug: string
  category: string
  excerpt: string
  content: string
  authorName: string
  published: boolean
  publishedAt: number | null
  createdAt: number
  updatedAt: number
}

export type WxrSite = {
  title: string
  url: string
  description?: string
  language?: string
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Wraps text in CDATA, splitting any literal "]]>" so the XML stays valid. */
function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Turns the editor's plain text into WordPress-friendly HTML. */
export function contentToHtml(content: string): string {
  const blocks = content.replace(/\r\n/g, '\n').split(/\n{2,}/)
  const html: string[] = []

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0) continue

    if (lines[0].startsWith('## ')) {
      html.push(`<h2>${escapeHtml(lines[0].slice(3))}</h2>`)
      continue
    }

    if (lines.every((line) => line.startsWith('- '))) {
      html.push(`<ul>\n${lines.map((line) => `  <li>${escapeHtml(line.slice(2))}</li>`).join('\n')}\n</ul>`)
      continue
    }

    html.push(`<p>${escapeHtml(lines.join(' '))}</p>`)
  }

  return html.join('\n\n')
}

function authorLogin(name: string): string {
  const login = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return login || 'editorial-desk'
}

function wordpressDate(timestamp: number): string {
  const iso = new Date(timestamp).toISOString()
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`
}

/** Builds a WordPress eXtended RSS (WXR 1.2) file that WordPress can import. */
export function buildWxr(posts: WxrPost[], site: WxrSite): string {
  const base = site.url.replace(/\/$/, '')
  const language = site.language ?? 'en-GB'
  const description = site.description ?? ''

  const authors = new Map<string, string>()
  for (const post of posts) {
    const login = authorLogin(post.authorName)
    if (!authors.has(login)) authors.set(login, post.authorName)
  }

  const items = posts.map((post, index) => {
    const date = post.publishedAt ?? post.createdAt
    const html = contentToHtml(post.content)
    const status = post.published ? 'publish' : 'draft'

    return [
      '  <item>',
      `    <title>${escapeXml(post.title)}</title>`,
      `    <link>${escapeXml(`${base}/journal/${post.slug}`)}</link>`,
      `    <pubDate>${new Date(date).toUTCString()}</pubDate>`,
      `    <dc:creator>${cdata(authorLogin(post.authorName))}</dc:creator>`,
      `    <guid isPermaLink="false">${escapeXml(`${base}/journal/${post.slug}`)}</guid>`,
      '    <description></description>',
      `    <content:encoded>${cdata(html)}</content:encoded>`,
      `    <excerpt:encoded>${cdata(post.excerpt)}</excerpt:encoded>`,
      `    <wp:post_id>${index + 1}</wp:post_id>`,
      `    <wp:post_date>${cdata(wordpressDate(date))}</wp:post_date>`,
      `    <wp:post_date_gmt>${cdata(wordpressDate(date))}</wp:post_date_gmt>`,
      '    <wp:comment_status>closed</wp:comment_status>',
      '    <wp:ping_status>closed</wp:ping_status>',
      `    <wp:post_name>${cdata(post.slug)}</wp:post_name>`,
      `    <wp:status>${status}</wp:status>`,
      '    <wp:post_parent>0</wp:post_parent>',
      '    <wp:menu_order>0</wp:menu_order>',
      '    <wp:post_type>post</wp:post_type>',
      '    <wp:post_password></wp:post_password>',
      '    <wp:is_sticky>0</wp:is_sticky>',
      `    <category domain="category" nicename="${escapeXml(authorLogin(post.category))}">${cdata(post.category)}</category>`,
      '  </item>',
    ].join('\n')
  })

  const authorBlocks = [...authors.entries()].map(([login, name]) =>
    [
      '  <wp:author>',
      `    <wp:author_id>${cdata(login)}</wp:author_id>`,
      `    <wp:author_login>${cdata(login)}</wp:author_login>`,
      `    <wp:author_email>${cdata('')}</wp:author_email>`,
      `    <wp:author_display_name>${cdata(name)}</wp:author_display_name>`,
      '    <wp:author_first_name></wp:author_first_name>',
      '    <wp:author_last_name></wp:author_last_name>',
      '  </wp:author>',
    ].join('\n'),
  )

  return [
    '<?xml version="1.0" encoding="UTF-8" ?>',
    '<rss version="2.0"',
    '  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"',
    '  xmlns:content="http://purl.org/rss/1.0/modules/content/"',
    '  xmlns:wfw="http://wellformedweb.org/CommentAPI/"',
    '  xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '  xmlns:wp="http://wordpress.org/export/1.2/">',
    '<channel>',
    `  <title>${escapeXml(site.title)}</title>`,
    `  <link>${escapeXml(base)}</link>`,
    `  <description>${escapeXml(description)}</description>`,
    `  <pubDate>${new Date().toUTCString()}</pubDate>`,
    `  <language>${escapeXml(language)}</language>`,
    '  <wp:wxr_version>1.2</wp:wxr_version>',
    `  <wp:base_site_url>${escapeXml(base)}</wp:base_site_url>`,
    `  <wp:base_blog_url>${escapeXml(base)}</wp:base_blog_url>`,
    ...authorBlocks,
    ...items,
    '</channel>',
    '</rss>',
    '',
  ].join('\n')
}
