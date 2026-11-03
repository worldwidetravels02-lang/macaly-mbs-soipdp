import { describe, expect, test } from "vitest"
import { buildWxr, contentToHtml } from "./wxr"
import type { WxrPost } from "./wxr"

const base: WxrPost = {
  _id: "posts:1",
  title: "Palm Jumeirah & the sea",
  slug: "palm-jumeirah-guide",
  category: "Market notes",
  excerpt: "What to check before you reserve.",
  content: "Opening paragraph.\n\n## What to check\n\n- Title deed\n- Service charges",
  authorName: "Msheireb editorial desk",
  published: true,
  publishedAt: Date.UTC(2026, 10, 2, 9, 30, 0),
  createdAt: Date.UTC(2026, 10, 1, 8, 0, 0),
  updatedAt: Date.UTC(2026, 10, 2, 9, 30, 0),
}

const site = { title: "Msheireb Properties", url: "https://example.com/", description: "Journal" }

describe("contentToHtml", () => {
  test("turns paragraphs, headings and lists into HTML", () => {
    const html = contentToHtml(base.content)
    expect(html).toContain("<p>Opening paragraph.</p>")
    expect(html).toContain("<h2>What to check</h2>")
    expect(html).toContain("<li>Title deed</li>")
    expect(html).toContain("</ul>")
  })

  test("escapes markup typed by the author", () => {
    expect(contentToHtml("Use <b>bold</b> & more")).toBe("<p>Use &lt;b&gt;bold&lt;/b&gt; &amp; more</p>")
  })
})

describe("buildWxr", () => {
  test("writes a WordPress import header and one item per article", () => {
    const xml = buildWxr([base], site)
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8" ?>')).toBe(true)
    expect(xml).toContain('<wp:wxr_version>1.2</wp:wxr_version>')
    expect(xml).toContain("<wp:base_blog_url>https://example.com</wp:base_blog_url>")
    expect(xml.match(/<item>/g)).toHaveLength(1)
    expect(xml).toContain("<title>Palm Jumeirah &amp; the sea</title>")
    expect(xml).toContain("<wp:status>publish</wp:status>")
    expect(xml).toContain("<wp:post_name><![CDATA[palm-jumeirah-guide]]></wp:post_name>")
    expect(xml).toContain('<category domain="category" nicename="market-notes">')
    expect(xml).toContain("<wp:post_date><![CDATA[2026-11-02 09:30:00]]></wp:post_date>")
    expect(xml).toContain('<wp:author_login><![CDATA[msheireb-editorial-desk]]></wp:author_login>')
    expect(xml).toContain("<content:encoded><![CDATA[<p>Opening paragraph.</p>")
  })

  test("marks drafts and keeps CDATA valid", () => {
    const xml = buildWxr(
      [{ ...base, published: false, publishedAt: null, excerpt: "Odd ]]> summary" }],
      site,
    )
    expect(xml).toContain("<wp:status>draft</wp:status>")
    expect(xml).not.toContain("]]>]]>")
    expect(xml).toContain("]]]]><![CDATA[>")
  })
})
