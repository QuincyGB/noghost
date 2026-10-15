import { useState, useEffect } from 'react'
import { useReadContract } from 'wagmi'
import { Loader2, ExternalLink, ChevronRight, ShieldAlert } from 'lucide-react'
import {
  BRIEF_BOND_ABI,
  BRIEF_BOND_ADDRESS,
  ARC_CHAIN_ID,
  BriefStatusLabel,
  ClientActionLabel,
} from '../contract'
import { formatBond, shortAddress, formatCountdown } from '../utils'
import { buildAddressExplorerUrl } from '@/onchain-facts'

const STATUS_BG: Record<number, string> = {
  0: 'rgba(18,45,69,0.09)',
  1: 'rgba(26,128,71,0.12)',
  2: 'rgba(186,43,76,0.12)',
  3: 'rgba(107,101,128,0.14)',
}
const STATUS_FG: Record<number, string> = {
  0: 'var(--ink)',
  1: 'var(--success)',
  2: 'var(--danger)',
  3: 'var(--muted)',
}

// Typed subset of what getBrief returns that the registry row needs
interface BriefRowData {
  client: string
  applicant: string
  bond: bigint
  deadline: bigint
  status: number
  action: number
  actionRecorded: boolean
  title: string
}

// ── Single row ──────────────────────────────────────────────────────────────
function BriefRow({ briefId, onClick }: { briefId: bigint; onClick: () => void }) {
  const { data: briefRaw } = useReadContract({
    address: BRIEF_BOND_ADDRESS,
    abi: BRIEF_BOND_ABI,
    functionName: 'getBrief',
    args: [briefId],
    chainId: ARC_CHAIN_ID,
  })

  // Live clock for countdown — updates every 10 s in the registry for perf
  const [nowSecs, setNowSecs] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNowSecs(Math.floor(Date.now() / 1000)), 10_000)
    return () => clearInterval(id)
  }, [])

  const brief = briefRaw as unknown as BriefRowData | undefined
  if (!brief || brief.client === '0x0000000000000000000000000000000000000000') return null

  const deadlineNum   = Number(brief.deadline)
  const isExpired     = nowSecs >= deadlineNum
  const countdown     = formatCountdown(deadlineNum, nowSecs)

  // Status label — include action when Resolved
  const statusLabel =
    brief.status === 1 && brief.actionRecorded
      ? `${BriefStatusLabel[1]} · ${ClientActionLabel[brief.action]}`
      : BriefStatusLabel[brief.status]

  return (
    <button
      onClick={onClick}
      className="group w-full rounded-3xl p-5 text-left transition-all hover:scale-[1.005] hover:shadow-sm"
      style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* ID + badge */}
          <div className="mb-0.5 flex flex-wrap items-center gap-2">
            <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
              #{briefId.toString()}
            </span>
            <span
              className="rounded-lg px-2 py-0.5 text-xs font-semibold"
              style={{ background: STATUS_BG[brief.status], color: STATUS_FG[brief.status] }}
            >
              {statusLabel}
            </span>
          </div>

          {/* Title */}
          <div className="display text-base font-700 truncate" style={{ color: 'var(--ink)' }}>
            {brief.title}
          </div>

          {/* Bond + client + countdown */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="tabular-nums text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
              {formatBond(brief.bond)} USDC
            </span>
            <a
              href={buildAddressExplorerUrl(ARC_CHAIN_ID, brief.client)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs hover:underline"
              style={{ color: 'var(--muted)' }}
            >
              Client: {shortAddress(brief.client)}
            </a>
            {/* Countdown shown for ALL statuses so past-deadline briefs show "Xd ago" */}
            <span
              className="text-xs font-medium"
              style={{ color: isExpired ? 'var(--danger)' : 'var(--success)' }}
            >
              {countdown}
            </span>
          </div>
        </div>

        <ChevronRight className="mt-1 size-4 shrink-0 opacity-30 group-hover:opacity-70" style={{ color: 'var(--ink)' }} />
      </div>

      {/* Outcome badge */}
      {brief.status === 1 && brief.actionRecorded && (
        <div className="mt-3 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(26,128,71,0.08)', color: 'var(--success)' }}>
          {ClientActionLabel[brief.action]} — {formatBond(brief.bond)} USDC returned to client
        </div>
      )}
      {brief.status === 2 && (
        <div className="mt-3 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(186,43,76,0.08)', color: 'var(--danger)' }}>
          Client ghosted — {formatBond(brief.bond)} USDC forfeited to applicant
        </div>
      )}
      {brief.status === 3 && (
        <div className="mt-3 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(107,101,128,0.1)', color: 'var(--muted)' }}>
          {formatBond(brief.bond)} USDC reclaimed by client (30-day claim window lapsed)
        </div>
      )}

    </button>
  )
}

// ── Registry ────────────────────────────────────────────────────────────────
export function Registry({ onBriefClick }: { onBriefClick: (id: bigint) => void }) {
  // Briefs are enumerated from the nextBriefId counter (IDs are sequential
  // from 1) and each row reads its own getBrief — no eth_getLogs, which Arc's
  // RPC caps at a 10,000-block range.
  const {
    data: nextBriefIdRaw,
    isLoading: counterLoading,
    error: counterError,
  } = useReadContract({
    address: BRIEF_BOND_ADDRESS,
    abi: BRIEF_BOND_ABI,
    functionName: 'nextBriefId',
    chainId: ARC_CHAIN_ID,
  })

  const fetched = !counterLoading
  const errorMsg = counterError
    ? 'Could not load briefs: ' + counterError.message
    : ''

  const totalBriefs = nextBriefIdRaw && nextBriefIdRaw > 0n ? Number(nextBriefIdRaw) - 1 : 0
  const briefIds: bigint[] = Array.from({ length: totalBriefs }, (_, i) =>
    BigInt(totalBriefs - i),
  )

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="display text-2xl font-700" style={{ color: 'var(--ink)' }}>Public registry</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--muted)' }}>
            {totalBriefs > 0
              ? `${totalBriefs} brief${totalBriefs !== 1 ? 's' : ''} posted`
              : 'No briefs yet'}
          </p>
        </div>
        {BRIEF_BOND_ADDRESS && (
          <a
            href={buildAddressExplorerUrl(ARC_CHAIN_ID, BRIEF_BOND_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium"
            style={{ color: 'var(--accent-hover)' }}
          >
            Contract <ExternalLink className="size-3" />
          </a>
        )}
      </div>

      {/* Contract not deployed notice */}
      {!BRIEF_BOND_ADDRESS && (
        <div className="mb-6 rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(18,45,69,0.06)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
          Contract not yet deployed — the registry will populate once deployed.
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(186,43,76,0.08)', color: 'var(--danger)' }}>
          {errorMsg}
        </div>
      )}

      {/* Body */}
      {!fetched ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin" style={{ color: 'var(--muted)' }} />
        </div>
      ) : briefIds.length === 0 ? (
        // ── Empty state ──────────────────────────────────────────────────────
        <div className="rounded-3xl p-12 text-center" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
          <div
            className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(18,45,69,0.06)' }}
          >
            <ShieldAlert className="size-6" style={{ color: 'var(--muted)' }} />
          </div>
          <p className="text-base font-semibold" style={{ color: 'var(--ink-2)' }}>No briefs yet</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Be the first to lock a bond. Post a brief to get started.
          </p>
          <p className="mt-3 text-xs" style={{ color: 'var(--subtle)' }}>
            When a client posts a brief, it appears here — newest first.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {briefIds.map((id) => (
            <BriefRow
              key={id.toString()}
              briefId={id}
              onClick={() => onBriefClick(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
