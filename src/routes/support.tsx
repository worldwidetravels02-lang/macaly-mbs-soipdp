import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { requireSupabase } from '@/lib/supabase-client'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { formatDate } from '../lib/format'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/support']

type SupportMessage = {
  id: string
  sender_id: string
  message: string
  created_at: string
}

export const Route = createFileRoute('/support')({
  head: () => {
    const canonical = canonicalUrl('/support')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: SupportPage,
})

function SupportPage() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [body, setBody] = useState('')
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [telegramUsername, setTelegramUsername] = useState('')

  useEffect(() => {
    const supabase = requireSupabase()
    supabase.from('support_settings').select('telegram_username').eq('id', 'default').maybeSingle().then(({ data }) => {
      setTelegramUsername(data?.telegram_username ?? '')
    })
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(sessionError.message)
      setUser(data.session?.user ?? null)
      setChecking(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setChecking(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const loadConversation = useCallback(async () => {
    if (!user) return
    setLoadingMessages(true)
    setError(null)
    try {
      const supabase = requireSupabase()
      const { data: threads, error: threadError } = await supabase
        .from('support_threads')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
      if (threadError) throw threadError
      const id = threads?.[0]?.id ?? null
      setThreadId(id)
      if (!id) {
        setMessages([])
        return
      }
      const { data, error: messagesError } = await supabase
        .from('support_messages')
        .select('id,sender_id,message,created_at')
        .eq('thread_id', id)
        .order('created_at', { ascending: true })
      if (messagesError) throw messagesError
      setMessages((data ?? []) as SupportMessage[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your support messages.')
    } finally {
      setLoadingMessages(false)
    }
  }, [user])

  useEffect(() => {
    void loadConversation()
  }, [loadConversation])

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || body.trim().length === 0 || body.trim().length > 5000) return
    setSending(true)
    setError(null)
    try {
      const supabase = requireSupabase()
      let activeThreadId = threadId
      if (!activeThreadId) {
        const { data: thread, error: createError } = await supabase
          .from('support_threads')
          .insert({ user_id: user.id })
          .select('id')
          .single()
        if (createError) throw createError
        activeThreadId = thread.id
        setThreadId(activeThreadId)
      }
      const { error: sendError } = await supabase.from('support_messages').insert({
        thread_id: activeThreadId,
        sender_id: user.id,
        message: body.trim(),
      })
      if (sendError) throw sendError
      setBody('')
      await loadConversation()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto w-full max-w-4xl px-5 sm:px-8">
          {checking ? (
            <div data-testid="support-loading" className="border border-border bg-card p-10 text-center text-sm text-ink-soft">Checking your session…</div>
          ) : !user ? (
            <div data-testid="support-signed-out" className="border border-border bg-card p-8 sm:p-12">
              <p className="eyebrow text-brass">Customer service</p>
              <h1 className="display mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)]">Sign in to open the chat.</h1>
              {telegramUsername ? <a href={`https://t.me/${encodeURIComponent(telegramUsername.replace(/^@/, ''))}`} target="_blank" rel="noopener noreferrer" data-testid="telegram-support-link" className="mt-5 inline-flex w-fit items-center gap-3 border border-brass bg-brass/10 px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-brass/20">Chat with us on Telegram <ArrowRight /></a> : null}
              <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">Members can message the administration team about an account, payment request or property.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/login" className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground">Login <ArrowRight /></Link>
                <Link to="/register" className="eyebrow inline-flex items-center justify-between gap-8 border border-border px-6 py-4 text-[0.6rem]">Create an account <ArrowRight /></Link>
              </div>
            </div>
          ) : (
            <div data-testid="support-panel" className="grid gap-6">
              <header className="border-b border-border pb-6">
                <p className="eyebrow text-brass">Customer service</p>
                <h1 className="display mt-3 text-[clamp(1.9rem,3.4vw,2.8rem)]">Chat with our team</h1>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-soft">Your messages are saved to your account and can be answered by administration.</p>
              </header>
              {telegramUsername ? <a href={`https://t.me/${encodeURIComponent(telegramUsername.replace(/^@/, ''))}`} target="_blank" rel="noopener noreferrer" data-testid="telegram-support-link" className="inline-flex w-fit items-center gap-3 border border-brass bg-brass/10 px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-brass/20">Chat with us on Telegram <ArrowRight /></a> : null}
              <section className="flex min-h-[22rem] flex-col border border-border bg-card">
                <div data-testid="support-messages" className="flex-1 space-y-4 p-5 sm:p-6">
                  {loadingMessages ? <p className="text-sm text-ink-soft">Loading your conversation…</p> : messages.length === 0 ? (
                    <div className="border border-border bg-bone/40 p-5 text-sm leading-relaxed text-ink-soft">No messages yet. Send a message to start a conversation.</div>
                  ) : messages.map((message) => {
                    const isMember = message.sender_id === user.id
                    return <div key={message.id} className={isMember ? 'flex justify-end' : 'flex justify-start'}>
                      <div className={['max-w-[85%] px-4 py-3 text-sm leading-relaxed', isMember ? 'bg-primary text-primary-foreground' : 'border border-border bg-background'].join(' ')}>
                        <p className="eyebrow text-[0.45rem] opacity-70">{isMember ? 'You' : 'Administration'} · {formatDate(new Date(message.created_at).getTime())}</p>
                        <p className="mt-2 whitespace-pre-wrap">{message.message}</p>
                      </div>
                    </div>
                  })}
                </div>
                <form onSubmit={send} className="border-t border-border p-4 sm:p-5">
                  {error ? <p role="alert" data-testid="support-error" className="mb-3 border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
                  <label className="block">
                    <span className="eyebrow text-[0.5rem] text-ink-soft">Your message</span>
                    <textarea rows={3} value={body} onChange={(event) => setBody(event.target.value)} disabled={sending} maxLength={5000} placeholder="How can we help?" data-testid="support-input" className="mt-2 w-full resize-none border border-input bg-background px-4 py-3 text-[0.95rem] outline-none focus:border-brass disabled:opacity-60" />
                  </label>
                  <button type="submit" disabled={sending || !body.trim()} data-testid="support-send" className="eyebrow mt-3 inline-flex items-center justify-between gap-8 bg-primary px-6 py-3.5 text-[0.58rem] text-primary-foreground disabled:opacity-60">{sending ? 'Sending…' : 'Send to administration'}<ArrowRight className="h-3.5 w-3.5" /></button>
                </form>
              </section>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
