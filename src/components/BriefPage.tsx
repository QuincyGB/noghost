import { useState, useEffect, useCallback } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi'
import { Loader2, ExternalLink, ChevronLeft, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  BRIEF_BOND_ABI,
  BRIEF_BOND_ADDRESS,
  ARC_TESTNET_CHAIN_ID,
  BriefStatusLabel,
  ClientActionLabel,
  parseContractError,
} from '../contract'
import { formatBond, shortAddress, formatCountdown, hashText } from '../utils'
import { buildTxExplorerUrl, buildAddressExplorerUrl } from '@/onchain-facts'

interface BriefPageProps {
  briefId: bigint
  onBack: () => void
}

const CLAIM_WINDOW_SECS = 30 * 24 * 3600   // 30 days in seconds

// Status badge colours
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

const ZERO_HASH    = '0x0000000000000000000000000000000000000000000000000000000000000000'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

// ── Tiny helper components ───────────────────────────────────────────────────

function TxLink({ hash }: { hash: `0x${string}` }) {
  return (
    <a
      href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, hash)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs mt-1 font-medium"
      style={{ color: 'var(--accent-hover)' }}
    >
      View on Arc Explorer <ExternalLink className="size-3" />
    </a>
  )
}

function AddrLink({ addr, label }: { addr: string; label: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'var(--surface-muted)' }}>
      <div className="mb-0.5 text-xs" style={{ color: 'var(--muted)' }}>{label}</div>
      <a
        href={buildAddressExplorerUrl(ARC_TESTNET_CHAIN_ID, addr)}
        target="_blank"
        rel="noreferrer"
        className="mono flex items-center gap-1 text-xs font-medium"
        style={{ color: 'var(--ink-2)' }}
      >
        {shortAddress(addr)} <ExternalLink className="size-3" />
      </a>
    </div>
  )
}

// ── Disabled-button wrapper — shows the reason inline ───────────────────────
function DisabledAction({ reason }: { reason: string }) {
  return (
    <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(18,45,69,0.04)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
      {reason}
    </div>
  )
}

// ── Role highlight wrapper ───────────────────────────────────────────────────
function RolePanel({
  role,
  children,
}: {
  role: 'client' | 'applicant' | 'observer'
  children: React.ReactNode
}) {
  const accent =
    role === 'client'
      ? 'rgba(18,45,69,0.06)'
      : role === 'applicant'
      ? 'rgba(26,128,71,0.06)'
      : 'transparent'
  const border =
    role === 'client'
      ? 'rgba(18,45,69,0.22)'
      : role === 'applicant'
      ? 'rgba(26,128,71,0.22)'
      : 'var(--border)'
  return (
    <div
      className="rounded-3xl p-5"
      style={{ background: accent, border: `1px solid ${border}` }}
    >
      {children}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export function BriefPage({ briefId, onBack }: BriefPageProps) {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const [workText, setWorkText]       = useState('')
  const [actionError, setActionError] = useState('')
  const [nowSecs, setNowSecs]         = useState(() => Math.floor(Date.now() / 1000))
  const [confirmedHash, setConfirmedHash] = useState<`0x${string}` | undefined>()

  // Tick every second for live countdown
  useEffect(() => {
    const id = setInterval(() => setNowSecs(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const { data: briefRaw, isLoading, refetch } = useReadContract({
    address: BRIEF_BOND_ADDRESS,
    abi: BRIEF_BOND_ABI,
    functionName: 'getBrief',
    args: [briefId],
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  const brief = briefRaw

  const {
    writeContract,
    data: txHash,
    isPending,
    reset: resetWrite,
  } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (!isSuccess) return
    void refetch()
    // resetWrite is called after a short delay so the hash survives
    // the render that follows refetch
    const t = setTimeout(() => resetWrite(), 3000)
    return () => clearTimeout(t)
  }, [isSuccess, refetch, resetWrite])

  const wrongChain      = isConnected && chainId !== ARC_TESTNET_CHAIN_ID
  const deadlineNum     = brief ? Number(brief.deadline) : 0
  const isDeadlinePassed     = brief ? nowSecs >= deadlineNum : false
  const isClaimWindowPassed  = brief ? nowSecs > deadlineNum + CLAIM_WINDOW_SECS : false
  const isOpen          = brief?.status === 0
  const isClient        = !!address && brief?.client.toLowerCase() === address.toLowerCase()
  const isApplicant     = !!address && brief?.applicant.toLowerCase() === address.toLowerCase()
  const hasWorkHash     = brief?.workHash !== ZERO_HASH
  const countdown       = deadlineNum ? formatCountdown(deadlineNum, nowSecs) : ''

  const doWrite = useCallback(
    (fn: () => void) => {
      setActionError('')
      if (!isConnected) { setActionError('Connect your wallet first.'); return }
      if (wrongChain)   { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
      fn()
    },
    [isConnected, wrongChain, switchChain],
  )

  function handleClientAction(action: number) {
    doWrite(() =>
      writeContract(
        { address: BRIEF_BOND_ADDRESS, abi: BRIEF_BOND_ABI, functionName: 'clientAction', args: [briefId, action], chainId: ARC_TESTNET_CHAIN_ID },
        { onError: (e) => setActionError(parseContractError(e)), onSuccess: (h) => setConfirmedHash(h) },
      ),
    )
  }

  function handleSubmitWork(e: React.FormEvent) {
    e.preventDefault()
    if (!workText.trim()) { setActionError('Work text is required.'); return }
    doWrite(() =>
      writeContract(
        { address: BRIEF_BOND_ADDRESS, abi: BRIEF_BOND_ABI, functionName: 'submitWork', args: [briefId, hashText(workText.trim())], chainId: ARC_TESTNET_CHAIN_ID },
        { onError: (e) => setActionError(parseContractError(e)), onSuccess: (h) => setConfirmedHash(h) },
      ),
    )
  }

  function handleClaimGhost() {
    doWrite(() =>
      writeContract(
        { address: BRIEF_BOND_ADDRESS, abi: BRIEF_BOND_ABI, functionName: 'claimGhost', args: [briefId], chainId: ARC_TESTNET_CHAIN_ID },
        { onError: (e) => setActionError(parseContractError(e)), onSuccess: (h) => setConfirmedHash(h) },
      ),
    )
  }

  function handleReclaimStale() {
    doWrite(() =>
      writeContract(
        { address: BRIEF_BOND_ADDRESS, abi: BRIEF_BOND_ABI, functionName: 'reclaimStale', args: [briefId], chainId: ARC_TESTNET_CHAIN_ID },
        { onError: (e) => setActionError(parseContractError(e)), onSuccess: (h) => setConfirmedHash(h) },
      ),
    )
  }

  // ── Loading / not found ────────────────────────────────────────────────────
  if (isLoading || !brief) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin" style={{ color: 'var(--muted)' }} />
      </div>
    )
  }

  if (brief.client === ZERO_ADDRESS) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p style={{ color: 'var(--muted)' }}>Brief #{briefId.toString()} does not exist.</p>
        <button onClick={onBack} className="mt-4 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
          Back
        </button>
      </div>
    )
  }

  // ── Status badge label (includes action when Resolved) ────────────────────
  const statusLabel =
    brief.status === 1 && brief.actionRecorded
      ? `${BriefStatusLabel[1]} · ${ClientActionLabel[brief.action]}`
      : BriefStatusLabel[brief.status]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Back */}
      <button onClick={onBack} className="mb-5 flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--muted)' }}>
        <ChevronLeft className="size-4" /> Registry
      </button>

      {/* ── Hero card ────────────────────────────────────────────────────────── */}
      <div className="mb-4 rounded-3xl p-6" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="mb-0.5 text-xs font-semibold tabular-nums" style={{ color: 'var(--muted)' }}>
              Brief #{briefId.toString()}
            </div>
            <h1 className="display text-xl font-700" style={{ color: 'var(--ink)' }}>{brief.title}</h1>
          </div>
          {/* Status badge — shows action label when Resolved */}
          <span
            className="shrink-0 rounded-xl px-3 py-1 text-xs font-semibold whitespace-nowrap"
            style={{ background: STATUS_BG[brief.status], color: STATUS_FG[brief.status] }}
          >
            {statusLabel}
          </span>
        </div>

        {/* Bond */}
        <div className="mb-4 flex items-baseline gap-1">
          <span className="display text-3xl font-700 tabular-nums" style={{ color: 'var(--ink)' }}>
            {formatBond(brief.bond)}
          </span>
          <span className="text-base font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
          <span className="ml-1 text-sm" style={{ color: 'var(--muted)' }}>bond</span>
        </div>

        {/* Deadline + live countdown — shown on every status */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Clock className="size-4 shrink-0" style={{ color: 'var(--muted)' }} />
          <span className="text-sm" style={{ color: 'var(--ink-2)' }}>
            Deadline:{' '}
            <span className="font-semibold">
              {new Date(deadlineNum * 1000).toLocaleString()}
            </span>
          </span>
          {countdown && (
            <span
              className="rounded-lg px-2 py-0.5 text-xs font-semibold"
              style={{
                background: isDeadlinePassed ? 'rgba(186,43,76,0.1)' : 'rgba(26,128,71,0.08)',
                color: isDeadlinePassed ? 'var(--danger)' : 'var(--success)',
              }}
            >
              {countdown}
            </span>
          )}
        </div>

        {/* Addresses */}
        <div className="grid grid-cols-2 gap-3">
          <AddrLink addr={brief.client}    label={isClient    ? 'Client (you)' : 'Client'} />
          <AddrLink addr={brief.applicant} label={isApplicant ? 'Applicant (you)' : 'Applicant'} />
        </div>

        {/* Outcome summary */}
        {brief.status === 1 && brief.actionRecorded && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl p-3" style={{ background: 'rgba(26,128,71,0.08)' }}>
            <CheckCircle2 className="size-4 shrink-0" style={{ color: 'var(--success)' }} />
            <span className="text-xs" style={{ color: 'var(--success)' }}>
              Client recorded <strong>{ClientActionLabel[brief.action]}</strong> — {formatBond(brief.bond)} USDC returned to client
            </span>
          </div>
        )}
        {brief.status === 2 && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl p-3" style={{ background: 'rgba(186,43,76,0.08)' }}>
            <AlertCircle className="size-4 shrink-0" style={{ color: 'var(--danger)' }} />
            <span className="text-xs" style={{ color: 'var(--danger)' }}>
              Client ghosted — {formatBond(brief.bond)} USDC forfeited to applicant
            </span>
          </div>
        )}
        {brief.status === 3 && (
          <div className="mt-3 rounded-2xl p-3" style={{ background: 'rgba(107,101,128,0.1)' }}>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {formatBond(brief.bond)} USDC reclaimed by client (30-day claim window lapsed)
            </span>
          </div>
        )}
      </div>

      {/* ── Hashes ───────────────────────────────────────────────────────────── */}
      <div className="mb-4 rounded-3xl p-5" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Hashes</h2>
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-0.5 text-xs" style={{ color: 'var(--muted)' }}>Brief hash</div>
            <div className="mono text-xs break-all" style={{ color: 'var(--ink-2)' }}>{brief.briefHash}</div>
          </div>
          <div>
            <div className="mb-0.5 text-xs" style={{ color: 'var(--muted)' }}>Work hash</div>
            <div
              className="mono text-xs break-all"
              style={{ color: hasWorkHash ? 'var(--ink-2)' : 'var(--subtle)' }}
            >
              {hasWorkHash ? brief.workHash : 'Not submitted yet'}
            </div>
            {brief.workSubmittedAt > 0n && (
              <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                Submitted: {new Date(Number(brief.workSubmittedAt) * 1000).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Confirmed tx banner ──────────────────────────────────────────────── */}
      {isSuccess && confirmedHash && (
        <div className="mb-4 rounded-2xl px-4 py-3" style={{ background: 'rgba(26,128,71,0.08)', border: '1px solid rgba(26,128,71,0.15)' }}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" style={{ color: 'var(--success)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--success)' }}>Transaction confirmed</span>
          </div>
          <TxLink hash={confirmedHash} />
        </div>
      )}

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {actionError && (
        <div className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(186,43,76,0.08)', border: '1px solid rgba(186,43,76,0.15)', color: 'var(--danger)' }}>
          {actionError}
        </div>
      )}

      {/* ── Role-gated actions ───────────────────────────────────────────────── */}
      {!isConnected ? (
        <RolePanel role="observer">
          <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>Connect your wallet to see available actions.</p>
        </RolePanel>
      ) : wrongChain ? (
        <button
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })}
          className="w-full rounded-2xl py-3.5 text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {isSwitching ? 'Switching…' : 'Switch to Arc Testnet'}
        </button>
      ) : isClient ? (
        // ── CLIENT panel ────────────────────────────────────────────────────
        <RolePanel role="client">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Your actions (client)</h2>
            <span className="rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ background: 'rgba(18,45,69,0.09)', color: 'var(--ink-2)' }}>You are the client</span>
          </div>

          {!isOpen ? (
            <DisabledAction reason={`Brief is ${BriefStatusLabel[brief.status].toLowerCase()} — no further actions available.`} />
          ) : !isDeadlinePassed ? (
            <>
              <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
                Record your decision before the deadline and the full bond returns to you immediately.
              </p>
              <div className="flex gap-2">
                {([['Hired', 0], ['Declined', 1], ['Closed', 2]] as const).map(([label, val]) => (
                  <button
                    key={val}
                    disabled={isPending || isConfirming}
                    onClick={() => handleClientAction(val)}
                    className="flex-1 rounded-2xl py-3 text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {isPending || isConfirming
                      ? <Loader2 className="mx-auto size-4 animate-spin" />
                      : label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                Deadline passes in <strong>{countdown}</strong> — act now or the bond may be claimed.
              </p>
            </>
          ) : isDeadlinePassed && !isClaimWindowPassed ? (
            <DisabledAction reason={`Deadline passed ${countdown}. You can reclaim the bond once the 30-day claim window lapses (if no applicant claims).`} />
          ) : isClaimWindowPassed ? (
            <>
              <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>The 30-day claim window has lapsed with no applicant claim. Reclaim your bond now.</p>
              <button
                disabled={isPending || isConfirming}
                onClick={handleReclaimStale}
                className="w-full rounded-2xl py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {isPending || isConfirming
                  ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirming…</span>
                  : `Reclaim ${formatBond(brief.bond)} USDC`}
              </button>
            </>
          ) : null}
        </RolePanel>
      ) : isApplicant ? (
        // ── APPLICANT panel ─────────────────────────────────────────────────
        <RolePanel role="applicant">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Your actions (applicant)</h2>
            <span className="rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ background: 'rgba(26,128,71,0.1)', color: 'var(--success)' }}>You are the applicant</span>
          </div>

          {!isOpen ? (
            <DisabledAction reason={`Brief is ${BriefStatusLabel[brief.status].toLowerCase()} — no further actions available.`} />
          ) : !isDeadlinePassed ? (
            // Submit work form
            <>
              <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
                Record the keccak256 hash of your work onchain. If the client ghosts you, return here after the deadline to claim the bond.
              </p>
              <form onSubmit={handleSubmitWork} className="flex flex-col gap-3">
                <textarea
                  value={workText}
                  onChange={(e) => setWorkText(e.target.value)}
                  rows={4}
                  placeholder="Paste your work, deliverables, or proof of completion…"
                  className="w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                />
                {workText.trim() && (
                  <p className="mono text-xs break-all" style={{ color: 'var(--subtle)' }}>
                    Hash: {hashText(workText.trim())}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isPending || isConfirming}
                  className="w-full rounded-2xl py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ background: 'var(--success)', color: '#fff' }}
                >
                  {isPending || isConfirming
                    ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirming…</span>
                    : hasWorkHash ? 'Update work hash' : 'Record work hash onchain'}
                </button>
              </form>
              {hasWorkHash && (
                <p className="mt-2 text-xs" style={{ color: 'var(--success)' }}>
                  Work hash already on record. You may update it until the deadline ({countdown}).
                </p>
              )}
            </>
          ) : isDeadlinePassed && !isClaimWindowPassed && hasWorkHash ? (
            // Claim ghost
            <>
              <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
                The client did not act before the deadline. Your work hash is on record — claim the {formatBond(brief.bond)} USDC bond now. You have until the claim window closes.
              </p>
              <button
                disabled={isPending || isConfirming}
                onClick={handleClaimGhost}
                className="w-full rounded-2xl py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: 'var(--danger)', color: '#fff' }}
              >
                {isPending || isConfirming
                  ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirming…</span>
                  : `Claim ${formatBond(brief.bond)} USDC ghost bond`}
              </button>
            </>
          ) : isDeadlinePassed && !isClaimWindowPassed && !hasWorkHash ? (
            <DisabledAction reason="The deadline has passed and no work hash was recorded before it — the bond cannot be claimed." />
          ) : isClaimWindowPassed ? (
            <DisabledAction reason="The 30-day claim window has expired. The client may now reclaim the bond." />
          ) : null}
        </RolePanel>
      ) : (
        // ── OBSERVER note ───────────────────────────────────────────────────
        <RolePanel role="observer">
          <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
            Read-only view — only the client ({shortAddress(brief.client)}) and the applicant ({shortAddress(brief.applicant)}) can act on this brief.
          </p>
        </RolePanel>
      )}
    </div>
  )
}
