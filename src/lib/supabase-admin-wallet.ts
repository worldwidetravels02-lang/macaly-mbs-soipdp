import { requireSupabase } from './supabase-client'
import { isCurrentUserAdmin } from './supabase-auth'

export type AdminTopupRequest = {
  id: string
  user_id: string
  amount: number
  currency: string
  payment_method: string | null
  payment_reference: string | null
  proof_url: string | null
  status: string
  admin_note: string | null
  created_at: string
}

export type AdminWithdrawalRequest = {
  id: string
  user_id: string
  amount: number
  currency: string
  payout_method: string | null
  payout_details: Record<string, unknown>
  status: string
  admin_note: string | null
  created_at: string
}

async function requireAdmin() {
  if (!(await isCurrentUserAdmin())) {
    throw new Error('Administrator access required.')
  }
}

/** Read top-up requests for the admin review queue. */
export async function getAdminTopupRequests(status?: 'pending' | 'approved' | 'rejected'): Promise<AdminTopupRequest[]> {
  await requireAdmin()
  let query = requireSupabase()
    .from('topup_requests')
    .select('id,user_id,amount,currency,payment_method,payment_reference,proof_url,status,admin_note,created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as AdminTopupRequest[]
}

/** Read withdrawal requests for the admin review queue. */
export async function getAdminWithdrawalRequests(status?: 'pending' | 'approved' | 'rejected' | 'paid'): Promise<AdminWithdrawalRequest[]> {
  await requireAdmin()
  let query = requireSupabase()
    .from('withdrawal_requests')
    .select('id,user_id,amount,currency,payout_method,payout_details,status,admin_note,created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as AdminWithdrawalRequest[]
}

/** Approve or reject a top-up; approval credits the internal wallet ledger atomically. */
export async function reviewAdminTopupRequest(
  requestId: string,
  approve: boolean,
  adminNote?: string,
): Promise<string | null> {
  await requireAdmin()
  const { data, error } = await requireSupabase().rpc('admin_review_topup', {
    p_request_id: requestId,
    p_approve: approve,
    p_admin_note: adminNote?.trim() || null,
  })
  if (error) throw error
  return (data as string | null) ?? null
}

/** Approve or reject a withdrawal request. Approval does not transfer money. */
export async function reviewAdminWithdrawalRequest(
  requestId: string,
  action: 'approve' | 'reject',
  adminNote?: string,
): Promise<string | null> {
  await requireAdmin()
  const { data, error } = await requireSupabase().rpc('admin_review_withdrawal', {
    p_request_id: requestId,
    p_action: action,
    p_admin_note: adminNote?.trim() || null,
  })
  if (error) throw error
  return (data as string | null) ?? null
}

/** Read recent financial audit entries visible to administrators. */
export async function getAdminFinancialAudit(limit = 100) {
  await requireAdmin()
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200)
  const { data, error } = await requireSupabase()
    .from('financial_audit_log')
    .select('id,actor_id,action,entity_type,entity_id,details,created_at')
    .order('created_at', { ascending: false })
    .limit(safeLimit)
  if (error) throw error
  return data ?? []
}
