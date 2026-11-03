import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'

type Thread = { id: string; status: string; created_at: string }
type Message = { id: string; sender_id: string; message: string; created_at: string }

export const Route = createFileRoute('/support')({ component: SupportPage })

function SupportPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadThreads = useCallback(async () => {
    if (!supabase) { setError('Support is not configured.'); setLoading(false); return }
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setUserId(null); setLoading(false); return }
    setUserId(auth.user.id)
    const { data, error: queryError } = await supabase.from('support_threads').select('id,status,created_at').order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    const rows = data ?? []
    setThreads(rows)
    setActiveThread(current => current ?? rows[0]?.id ?? null)
    setLoading(false)
  }, [])

  const loadMessages = useCallback(async (threadId: string) => {
    if (!supabase) return
    const { data, error: queryError } = await supabase.from('support_messages').select('id,sender_id,message,created_at').eq('thread_id', threadId).order('created_at', { ascending: true })
    if (queryError) setError(queryError.message)
    else setMessages(data ?? [])
  }, [])

  useEffect(() => { void loadThreads() }, [loadThreads])
  useEffect(() => { if (activeThread) void loadMessages(activeThread) }, [activeThread, loadMessages])

  const createThread = async () => {
    if (!supabase || !userId) return
    setBusy(true); setError(null)
    const { data, error: createError } = await supabase.from('support_threads').insert({ user_id: userId, status: 'open' }).select('id,status,created_at').single()
    if (createError) setError(createError.message)
    else if (data) { setThreads(rows => [data, ...rows]); setActiveThread(data.id); setMessages([]) }
    setBusy(false)
  }

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !userId || !activeThread || !draft.trim()) return
    setBusy(true); setError(null)
    const { error: sendError } = await supabase.from('support_messages').insert({ thread_id: activeThread, sender_id: userId, message: draft.trim() })
    if (sendError) setError(sendError.message)
    else { setDraft(''); await loadMessages(activeThread) }
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-32 sm:px-8">
        <p className="eyebrow text-brass">Member services</p>
        <h1 className="display mt-3 text-4xl">Customer support</h1>
        <p className="mt-3 text-sm text-ink-soft">Send a message to the Msheireb Properties support team.</p>
        {error ? <p role="alert" className="mt-6 border border-destructive/40 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {loading ? <p className="py-12 text-sm text-ink-soft">Loading support…</p> : !userId ? (
          <div className="mt-8 border border-border bg-card p-8"><p>Please sign in to contact support.</p><Link to="/login" className="eyebrow mt-5 inline-flex items-center gap-3 underline">Member login <ArrowRight /></Link></div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-[220px_1fr]">
            <aside className="border border-border bg-card p-4">
              <button onClick={createThread} disabled={busy} className="eyebrow w-full bg-primary px-4 py-3 text-primary-foreground">New conversation</button>
              <div className="mt-4 grid gap-2">{threads.map(thread => <button key={thread.id} onClick={() => setActiveThread(thread.id)} className={activeThread===thread.id?'border border-brass bg-brass/10 p-3 text-left text-sm':'border border-border p-3 text-left text-sm'}><span className="block">Conversation</span><span className="mt-1 block text-xs text-ink-soft">{thread.status} · {new Date(thread.created_at).toLocaleDateString()}</span></button>)}</div>
            </aside>
            <section className="flex min-h-[420px] flex-col border border-border bg-card p-5">
              <div className="flex-1 space-y-4">{messages.map(message=><div key={message.id} className={message.sender_id===userId?'ml-auto max-w-[85%] bg-primary p-3 text-primary-foreground':'max-w-[85%] border border-border p-3'}><p className="text-sm">{message.message}</p><p className="mt-2 text-[10px] opacity-70">{new Date(message.created_at).toLocaleString()}</p></div>)}{activeThread && !messages.length ? <p className="py-12 text-center text-sm text-ink-soft">Start the conversation by sending a message.</p>:null}{!activeThread?<p className="py-12 text-center text-sm text-ink-soft">Create a conversation to contact support.</p>:null}</div>
              {activeThread?<form onSubmit={sendMessage} className="mt-5 flex gap-2 border-t border-border pt-4"><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Write your message…" className="min-w-0 flex-1 border border-input bg-background px-3 py-3 text-sm"/><button disabled={busy||!draft.trim()} className="eyebrow bg-primary px-5 py-3 text-primary-foreground">Send</button></form>:null}
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
