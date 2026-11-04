import { requireSupabase } from './supabase-client'

export type PublicProperty = {
  id: string
  slug: string
  name: string
  location: string | null
  description: string | null
  price_label: string
  cover_image_url: string | null
  status: 'draft' | 'published' | 'archived'
}

export type PublicPromotion = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  starts_at: string | null
  ends_at: string | null
}

export type PublicPost = {
  id: string
  title: string
  slug: string
  category: string
  excerpt: string
  content: string
  cover_image_url: string | null
  author_name: string
  published_at: string | null
}

export async function getPublishedProperties(): Promise<PublicProperty[]> {
  const { data, error } = await requireSupabase()
    .from('properties')
    .select('id,slug,name,location,description,price_label,cover_image_url,status')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PublicProperty[]
}

export async function getActivePromotions(): Promise<PublicPromotion[]> {
  const now = new Date().toISOString()
  const { data, error } = await requireSupabase()
    .from('promotions')
    .select('id,title,description,image_url,starts_at,ends_at')
    .eq('active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PublicPromotion[]
}

export async function getPublishedPosts(limit = 10): Promise<PublicPost[]> {
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)))
  const { data, error } = await requireSupabase()
    .from('posts')
    .select('id,title,slug,category,excerpt,content,cover_image_url,author_name,published_at')
    .eq('published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(safeLimit)
  if (error) throw new Error(error.message)
  return (data ?? []) as PublicPost[]
}

export async function submitPropertyEnquiry(input: {
  name: string
  email?: string
  mobile: string
  propertyId?: string
  message?: string
  source?: string
}): Promise<string> {
  const name = input.name.trim()
  const mobile = input.mobile.trim()
  const email = input.email?.trim() || null
  const message = input.message?.trim() || null
  if (name.length < 2) throw new Error('Please enter your name.')
  if (mobile.length < 5) throw new Error('Please enter a valid mobile number.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.')
  }
  if (message && message.length > 5000) throw new Error('Your message is too long.')

  const { data, error } = await requireSupabase()
    .from('enquiries')
    .insert({
      full_name: name,
      email,
      mobile,
      property_id: input.propertyId || null,
      message,
      source: input.source?.trim().slice(0, 80) || 'website',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}
