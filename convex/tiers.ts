/** Membership programme thresholds and shared wallet constants. */

export const SIGN_IN_BONUS_AED = 200

export type Tier = {
  level: number
  name: string
  minTopUpAed: number
  /** How many residence projects this level unlocks for the member. */
  propertyAllowance: number
  summary: string
  benefits: string[]
}

export const TIERS: Tier[] = [
  {
    level: 1,
    name: 'Level 1 · Resident',
    minTopUpAed: 0,
    propertyAllowance: 20,
    summary: 'Open to every registered member, from the moment you sign in.',
    benefits: [
      'AED 200 sign-in bonus credited to your wallet',
      '20 residence projects unlocked',
      'Access to residence previews and floor plans',
      'Quarterly market note for Dubai residential',
    ],
  },
  {
    level: 2,
    name: 'Level 2 · Investor',
    minTopUpAed: 50_000,
    propertyAllowance: 40,
    summary: 'Unlocked once approved top-ups reach AED 50,000.',
    benefits: [
      'Everything in Level 1',
      '40 residence projects unlocked',
      'Priority viewing slots with the residential team',
      'Reservation priority on new releases',
    ],
  },
  {
    level: 3,
    name: 'Level 3 · Portfolio',
    minTopUpAed: 200_000,
    propertyAllowance: 60,
    summary: 'Unlocked once approved top-ups reach AED 200,000.',
    benefits: [
      'Everything in Level 2',
      '60 residence projects unlocked',
      'Dedicated portfolio advisor',
      'Annual portfolio review with the design practice',
    ],
  },
  {
    level: 4,
    name: 'Senior Projects',
    minTopUpAed: 1_000_000,
    propertyAllowance: 80,
    summary: 'Upgrade for members funding senior projects.',
    benefits: [
      'Everything in Level 3',
      '80 residence projects unlocked',
      'Senior project allocations',
      'Quarterly portfolio review',
    ],
  },
  {
    level: 5,
    name: 'Premium Projects',
    minTopUpAed: 5_000_000,
    propertyAllowance: 100,
    summary: 'Upgrade for members funding premium projects.',
    benefits: [
      'Everything in Senior Projects',
      '100 residence projects unlocked',
      'Premium project allocations',
      'Private viewing programme',
    ],
  },
  {
    level: 6,
    name: 'Exclusive Projects',
    minTopUpAed: 10_000_000,
    propertyAllowance: 120,
    summary: 'The highest upgrade, for exclusive project partners.',
    benefits: [
      'Everything in Premium Projects',
      '120 residence projects unlocked',
      'Exclusive project allocations',
      'Direct line to the founding team',
    ],
  },
]

export function tierForTopUp(totalTopUpAed: number): Tier {
  let current = TIERS[0]
  for (const tier of TIERS) {
    if (totalTopUpAed >= tier.minTopUpAed) current = tier
  }
  return current
}

export function nextTier(totalTopUpAed: number): Tier | null {
  return TIERS.find((tier) => tier.minTopUpAed > totalTopUpAed) ?? null
}
