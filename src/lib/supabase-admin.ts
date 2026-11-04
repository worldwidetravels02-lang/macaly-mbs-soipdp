import { requireSupabase } from './supabase-client'
import type { WalletCurrency } from './supabase-wallet'

export type AdminTopupRequest = {
  id: string
  user_id: string
  amount: number
  currency: WalletCurrency
  payment_method: string | null
  payment_reference: string | null
  proof_url: string | null
  status: string
  created_at: string
}

export type AdminWithdrawalRequest = {
  id: string
  user_id: string
  amount: number
  currency: WalletCurrency
  payout_method: string | null
  payout_details: Record<string, unknown>
  status: string
  created_at: string
}

async function requireAdmin() {
  const client = requireSupabase()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Please sign in with your administrator account.')

  const { data, error } = await client
    .from('admin_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Administrator access required.')
  return { client, user, role: data.role as 'owner' | 'admin' }
}

/** Verify administrator access using the database membership policy. */
export async function getMyAdminRole(): Promise<'owner' | 'admin' | null> {
  try {
    const { role } = await requireAdmin()
    return role
  } catch (error) {
    if (error instanceof Error && error.message === 'Administrator access required.') return null
    throw error
  }
}

/** List top-up requests visible to the authenticated administrator. */
export async function getAdminTopupRequests(): Promise<AdminTopupRequest[]> {
  const { client } = await requireAdmin()
  const { data, error } = await client
    .from('topup_requests')
    .select('id,user_id,amount,currency,payment_method,payment_reference,proof_url,status,created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as AdminTopupRequest[]
}

/** Approve/reject a top-up and atomically write its wallet ledger credit. */
export async function reviewAdminTopup(id: string, approve: boolean, note = ''): Promise<string | null> {
  const { client } = await requireAdmin()
  const { data, error } = await client.rpc('admin_review_topup', {
    p_request_id: id,
    p_approve: approve,
    p_admin_note: note || null,
  })
  if (error) throw error
  return (data as string | null) ?? null
}

/** List withdrawal requests visible to the authenticated administrator. */
export async function getAdminWithdrawalRequests(): Promise<AdminWithdrawalRequest[]> {
  const { client } = await requireAdmin()
  const { data, error } = await client
    .from('withdrawal_requests')
    .select('id,user_id,amount,currency,payout_method,payout_details,status,created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as AdminWithdrawalRequest[]
}

/** Review or mark a withdrawal paid in the internal ledger only. */
export async function reviewAdminWithdrawal(
  id: string,
  action: 'approve' | 'reject' | 'pay',
  note = '',
): Promise<string | null> {
  const { client } = await requireAdmin()
  const { data, error } = await client.rpc('admin_review_withdrawal', {
    p_request_id: id,
    p_action: action,
    p_admin_note: note || null,
  })
  if (error) throw error
  return (data as string | null) ?? null
}

/** Credit a manually approved profit payout to a customer's internal wallet. */
export async function creditAdminProfit(input: {
  userId: string
  amount: number
  currency: WalletCurrency
  periodStart: string
  periodEnd: string
  description?: string
}): Promise<string> {
  const { client } = await requireAdmin()
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Profit amount must be greater than zero.')
  }
  const { data, error } = await client.rpc('admin_credit_profit_payout', {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_currency: input.currency,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_description: input.description || null,
  })
  if (error) throw error
  return data as string
}
