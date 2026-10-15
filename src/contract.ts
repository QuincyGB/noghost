/**
 * BriefBond contract config.
 * Address is set after deploy — wired in at deploy time.
 */
export const BRIEF_BOND_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ?? '') as `0x${string}`

export const ARC_TESTNET_CHAIN_ID = 5042002

export const BRIEF_BOND_ABI = [
  // constants
  {
    type: 'function', name: 'MIN_BOND', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'MAX_BOND', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'MIN_DURATION', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'MAX_DURATION', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'CLAIM_WINDOW', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'nextBriefId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }],
  },
  // getBrief
  {
    type: 'function',
    name: 'getBrief',
    stateMutability: 'view',
    inputs: [{ name: 'briefId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'client', type: 'address' },
          { name: 'applicant', type: 'address' },
          { name: 'bond', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'briefHash', type: 'bytes32' },
          { name: 'title', type: 'string' },
          { name: 'workHash', type: 'bytes32' },
          { name: 'workSubmittedAt', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'action', type: 'uint8' },
          { name: 'actionRecorded', type: 'bool' },
        ],
      },
    ],
  },
  // postBrief
  {
    type: 'function',
    name: 'postBrief',
    stateMutability: 'payable',
    inputs: [
      { name: 'applicant', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'briefHash', type: 'bytes32' },
      { name: 'title', type: 'string' },
    ],
    outputs: [{ name: 'briefId', type: 'uint256' }],
  },
  // submitWork
  {
    type: 'function',
    name: 'submitWork',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'briefId', type: 'uint256' },
      { name: 'workHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  // clientAction
  {
    type: 'function',
    name: 'clientAction',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'briefId', type: 'uint256' },
      { name: 'action', type: 'uint8' },
    ],
    outputs: [],
  },
  // claimGhost
  {
    type: 'function',
    name: 'claimGhost',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'briefId', type: 'uint256' }],
    outputs: [],
  },
  // reclaimStale
  {
    type: 'function',
    name: 'reclaimStale',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'briefId', type: 'uint256' }],
    outputs: [],
  },
  // Events
  {
    type: 'event',
    name: 'BriefPosted',
    inputs: [
      { name: 'briefId', type: 'uint256', indexed: true },
      { name: 'client', type: 'address', indexed: true },
      { name: 'applicant', type: 'address', indexed: true },
      { name: 'bond', type: 'uint256', indexed: false },
      { name: 'deadline', type: 'uint256', indexed: false },
      { name: 'briefHash', type: 'bytes32', indexed: false },
      { name: 'title', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WorkSubmitted',
    inputs: [
      { name: 'briefId', type: 'uint256', indexed: true },
      { name: 'applicant', type: 'address', indexed: true },
      { name: 'workHash', type: 'bytes32', indexed: false },
      { name: 'submittedAt', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BriefResolved',
    inputs: [
      { name: 'briefId', type: 'uint256', indexed: true },
      { name: 'client', type: 'address', indexed: true },
      { name: 'action', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BondReturned',
    inputs: [
      { name: 'briefId', type: 'uint256', indexed: true },
      { name: 'client', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'GhostClaimed',
    inputs: [
      { name: 'briefId', type: 'uint256', indexed: true },
      { name: 'applicant', type: 'address', indexed: true },
      { name: 'workHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BondForfeited',
    inputs: [
      { name: 'briefId', type: 'uint256', indexed: true },
      { name: 'applicant', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BondReclaimed',
    inputs: [
      { name: 'briefId', type: 'uint256', indexed: true },
      { name: 'client', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  // Custom errors
  { type: 'error', name: 'BondTooSmall', inputs: [] },
  { type: 'error', name: 'BondTooLarge', inputs: [] },
  { type: 'error', name: 'ZeroApplicant', inputs: [] },
  { type: 'error', name: 'ApplicantIsClient', inputs: [] },
  { type: 'error', name: 'DeadlineTooSoon', inputs: [] },
  { type: 'error', name: 'DeadlineTooFar', inputs: [] },
  { type: 'error', name: 'ZeroBriefHash', inputs: [] },
  { type: 'error', name: 'TitleEmpty', inputs: [] },
  { type: 'error', name: 'TitleTooLong', inputs: [] },
  { type: 'error', name: 'BriefNotFound', inputs: [] },
  { type: 'error', name: 'BriefNotOpen', inputs: [] },
  { type: 'error', name: 'NotApplicant', inputs: [] },
  { type: 'error', name: 'NotClient', inputs: [] },
  { type: 'error', name: 'DeadlinePassed', inputs: [] },
  { type: 'error', name: 'ZeroWorkHash', inputs: [] },
  { type: 'error', name: 'DeadlineNotPassed', inputs: [] },
  { type: 'error', name: 'ClaimWindowExpired', inputs: [] },
  { type: 'error', name: 'NoWorkRecorded', inputs: [] },
  { type: 'error', name: 'WorkSubmittedLate', inputs: [] },
  { type: 'error', name: 'ClaimWindowNotExpired', inputs: [] },
] as const

// --- Types ---
export type BriefStatus = 0 | 1 | 2 | 3  // Open, Resolved, Forfeited, Reclaimed
export const BriefStatusLabel: Record<number, string> = {
  0: 'Open',
  1: 'Resolved',
  2: 'Forfeited',
  3: 'Reclaimed',
}
export const ClientActionLabel: Record<number, string> = {
  0: 'Hired',
  1: 'Declined',
  2: 'Closed',
}

export interface BriefData {
  client: `0x${string}`
  applicant: `0x${string}`
  bond: bigint
  deadline: bigint
  briefHash: `0x${string}`
  title: string
  workHash: `0x${string}`
  workSubmittedAt: bigint
  status: number
  action: number
  actionRecorded: boolean
}

// Friendly revert messages
export function parseContractError(err: unknown): string {
  const msg = (err as Error)?.message ?? String(err)
  const lower = msg.toLowerCase()

  if (lower.includes('user rejected') || lower.includes('user denied')) return 'Transaction cancelled.'
  if (lower.includes('bondtoosmall')) return 'Bond is below the 1 USDC minimum.'
  if (lower.includes('bondtoolarge')) return 'Bond exceeds the 1,000 USDC maximum.'
  if (lower.includes('zeroapplicant')) return 'Applicant address cannot be zero.'
  if (lower.includes('applicantisclient')) return 'You cannot name yourself as the applicant.'
  if (lower.includes('deadlinetoosoon')) return 'Deadline must be at least 1 hour from now.'
  if (lower.includes('deadlinetoofar')) return 'Deadline cannot be more than 90 days from now.'
  if (lower.includes('zerobriefhash')) return 'Brief text cannot be empty (hash is zero).'
  if (lower.includes('titleempty')) return 'Title cannot be empty.'
  if (lower.includes('titletoolong')) return 'Title is too long (max 120 bytes).'
  if (lower.includes('briefnotfound')) return 'Brief not found.'
  if (lower.includes('briefnotopen')) return 'This brief is no longer open.'
  if (lower.includes('notapplicant')) return 'Only the named applicant can do this.'
  if (lower.includes('notclient')) return 'Only the client can record an action.'
  if (lower.includes('deadlinepassed')) return 'The deadline has already passed.'
  if (lower.includes('zeroworkhash')) return 'Work text cannot be empty (hash is zero).'
  if (lower.includes('deadlinenotpassed')) return 'The deadline has not passed yet.'
  if (lower.includes('claimwindowexpired')) return 'The 30-day claim window has expired.'
  if (lower.includes('noworkrecorded')) return 'No work was recorded before the deadline.'
  if (lower.includes('worksubmittedlate')) return 'Work was submitted after the deadline.'
  if (lower.includes('claimwindownotexpired')) return 'The 30-day claim window has not expired yet.'
  if (lower.includes('insufficient funds')) return 'Insufficient USDC balance for this bond.'
  if (lower.includes('reverted')) return 'Transaction failed — please check the form and try again.'
  return 'Something went wrong. Please try again.'
}
