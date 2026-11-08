import { requireSupabase } from './supabase-client'

export type WalletCurrency = 'AED' | 'OMR' | 'SAR' | 'KWD' | 'BHD' | 'QAR' | 'INR'

export type WalletBalance = {
  user_id: string
  currency: WalletCurrency
  total_credits: number
  total_debits: number
  balance: number
}

export type WalletTransaction = {
  id: string
  transaction_type: string
  direction: 'credit' | 'debit'
  amount: number
  currency: WalletCurrency
  status: 'posted' | 'reversed'
  description: string | null
  created_at: string
}

async function requireUserId(): Promise<string> {
  const { data, error } = await requireSupabase().auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Please sign in to view your wallet.')
  return data.user.id
}

/** Read the signed-in customer's ledger-derived wallet balances. */
export async function getMyWalletBalances(): Promise<WalletBalance[]> {
  await requireUserId()
  const { data, error } = await requireSupabase()
    .from('wallet_balances')
    .select('user_id,currency,total_credits,total_debits,balance')
  if (error) throw error
  return (data ?? []) as WalletBalance[]
}

/** Read the signed-in customer's immutable wallet history. */
export async function getMyWalletTransactions(limit = 50): Promise<WalletTransaction[]> {
  await requireUserId()
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100)
  const { data, error } = await requireSupabase()
    .from('wallet_transactions')
    .select('id,transaction_type,direction,amount,currency,status,description,created_at')
    .order('created_at', { ascending: false })
    .limit(safeLimit)
  if (error) throw error
  return (data ?? []) as WalletTransaction[]
}

/** Submit a pending top-up request. Approval and crediting remain admin-only. */
export async function submitMyTopupRequest(input: {
  amount: number
  currency: WalletCurrency
  paymentMethod: string
  paymentReference?: string
  proofUrl?: string
}): Promise<string> {
  const userId = await requireUserId()
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Enter an amount greater than zero.')
  }
  const { data, error } = await requireSupabase()
    .from('topup_requests')
    .insert({
      user_id: userId,
      amount: input.amount,
      currency: input.currency,
      payment_method: input.paymentMethod.trim() || null,
      payment_reference: input.paymentReference?.trim() || null,
      proof_url: input.proofUrl?.trim() || null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

/** Submit a pending withdrawal request. This does not transfer money. */
export async function submitMyWithdrawalRequest(input: {
  amount: number
  currency: WalletCurrency
  payoutMethod: string
  payoutDetails: Record<string, string>
}): Promise<string> {
  const userId = await requireUserId()
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Enter an amount greater than zero.')
  }
  const { data, error } = await requireSupabase()
    .from('withdrawal_requests')
    .insert({
      user_id: userId,
      amount: input.amount,
      currency: input.currency,
      payout_method: input.payoutMethod.trim() || null,
      payout_details: input.payoutDetails,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}
