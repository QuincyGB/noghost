import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { Loader2, ExternalLink, Info, CheckCircle2 } from 'lucide-react'
import { BRIEF_BOND_ABI, BRIEF_BOND_ADDRESS, ARC_TESTNET_CHAIN_ID, parseContractError } from '../contract'
import { hashText, parseBond } from '../utils'
import { buildTxExplorerUrl } from '@/onchain-facts'

const MIN_BOND_USDC = 1
const MAX_BOND_USDC = 1000

const DURATION_OPTIONS = [
  { label: '1 hour',   seconds: 3_600 },
  { label: '24 hours', seconds: 86_400 },
  { label: '3 days',   seconds: 259_200 },
  { label: '7 days',   seconds: 604_800 },
  { label: '14 days',  seconds: 1_209_600 },
  { label: '30 days',  seconds: 2_592_000 },
  { label: '60 days',  seconds: 5_184_000 },
  { label: '90 days',  seconds: 7_776_000 },
]

export function PostBrief({ onBriefPosted }: { onBriefPosted: (id: bigint) => void }) {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const [applicant,    setApplicant]    = useState('')
  const [bondAmount,   setBondAmount]   = useState('5')
  const [durationSecs, setDurationSecs] = useState(604_800)   // 7 days default
  const [title,        setTitle]        = useState('')
  const [briefText,    setBriefText]    = useState('')
  const [formError,    setFormError]    = useState('')

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const wrongChain  = isConnected && chainId !== ARC_TESTNET_CHAIN_ID
  const titleBytes  = new TextEncoder().encode(title).length
  const titleTooLong = titleBytes > 120

  // Single briefHash computation — uses the one hashText helper from utils
  const briefHashPreview = briefText.trim() ? hashText(briefText.trim()) : null

  function validate(): string | null {
    if (!isConnected) return 'Connect your wallet first.'
    if (wrongChain)   return 'Switch to Arc Testnet first.'
    if (!applicant.startsWith('0x') || applicant.length !== 42)
      return 'Enter a valid applicant wallet address (0x…, 42 characters).'
    if (applicant.toLowerCase() === address?.toLowerCase())
      return 'You cannot name yourself as the applicant.'
    const bond = parseFloat(bondAmount)
    if (isNaN(bond) || bond < MIN_BOND_USDC)  return `Bond must be at least ${MIN_BOND_USDC} USDC.`
    if (bond > MAX_BOND_USDC)                  return `Bond cannot exceed ${MAX_BOND_USDC} USDC.`
    if (!title.trim())                          return 'Title is required.'
    if (titleBytes > 120)                       return 'Title is too long (max 120 bytes).'
    if (!briefText.trim())                      return 'Brief text is required (its hash is stored onchain).'
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    const err = validate()
    if (err) { setFormError(err); return }

    // hashText is the single hash helper — used here and in submit-work
    const briefHash = hashText(briefText.trim())
    const bondRaw   = parseBond(bondAmount)           // single conversion helper
    const deadline  = BigInt(Math.floor(Date.now() / 1000) + durationSecs)

    writeContract(
      {
        address: BRIEF_BOND_ADDRESS,
        abi: BRIEF_BOND_ABI,
        functionName: 'postBrief',
        args: [applicant as `0x${string}`, deadline, briefHash, title],
        value: bondRaw,
        chainId: ARC_TESTNET_CHAIN_ID,
      },
      {
        onError: (e) => setFormError(parseContractError(e)),
      },
    )
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (isSuccess && txHash) {
    const txUrl = buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, txHash)
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <div
          className="rounded-3xl p-6"
          style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
        >
          <div
            className="mb-3 flex size-11 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(26,128,71,0.1)' }}
          >
            <CheckCircle2 className="size-6" style={{ color: 'var(--success)' }} />
          </div>
          <h2 className="display text-xl font-700 mb-1" style={{ color: 'var(--ink)' }}>Brief posted!</h2>
          <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>
            Your bond is locked. The applicant can now submit their work.
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            Record your decision before the deadline and the full bond returns to you.
          </p>
          {/* Transaction explorer link — required per spec */}
          <a
            href={txUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
            style={{ background: 'rgba(16,97,166,0.08)', color: 'var(--accent-hover)' }}
          >
            <ExternalLink className="size-3.5" />
            View transaction on Arc Explorer
          </a>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => reset()}
              className="flex-1 rounded-2xl py-3 text-sm font-semibold"
              style={{ background: 'var(--surface-muted)', color: 'var(--ink-2)' }}
            >
              Post another
            </button>
            <button
              onClick={() => onBriefPosted(0n)}
              className="flex-1 rounded-2xl py-3 text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              View registry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="display text-2xl font-700 mb-1" style={{ color: 'var(--ink)' }}>Post a brief</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        Lock a USDC bond naming one applicant. Record your decision before the deadline and it returns in full.
      </p>

      {/* ── Limits callout ─────────────────────────────────────────────────── */}
      <div
        className="mb-6 rounded-2xl px-4 py-3 flex gap-3"
        style={{ background: 'rgba(18,45,69,0.04)', border: '1px solid var(--border)' }}
      >
        <Info className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          <span>Bond: <strong style={{ color: 'var(--ink-2)' }}>1–1,000 USDC</strong></span>
          <span className="mx-2 opacity-40">·</span>
          <span>Duration: <strong style={{ color: 'var(--ink-2)' }}>1 hour – 90 days</strong></span>
          <div className="mt-1 opacity-80">
            After the deadline, the applicant has <strong style={{ color: 'var(--ink-2)' }}>30 days</strong> to claim the bond if you haven't acted.
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Applicant address */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
            Applicant wallet address
          </label>
          <input
            value={applicant}
            onChange={(e) => setApplicant(e.target.value.trim())}
            placeholder="0x…"
            className="mono w-full rounded-2xl px-4 py-3 text-sm outline-none"
            style={{
              background: 'var(--surface-muted)',
              border: '1px solid var(--border)',
              color: 'var(--ink)',
            }}
          />
        </div>

        {/* Bond amount */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
            Bond amount (USDC)
          </label>
          <div className="relative">
            <input
              inputMode="decimal"
              value={bondAmount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '')
                if (v === '' || /^\d*\.?\d*$/.test(v)) setBondAmount(v)
              }}
              className="display w-full rounded-2xl px-4 py-3 text-2xl font-600 tabular-nums outline-none"
              style={{
                background: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                color: 'var(--ink)',
              }}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--subtle)' }}>
              USDC
            </span>
          </div>
          {/* Quick-pick chips */}
          <div className="mt-1.5 flex gap-2">
            {[1, 5, 10, 50, 100].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setBondAmount(String(v))}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
                style={{
                  background: bondAmount === String(v) ? 'var(--accent)' : 'var(--surface-muted)',
                  color: bondAmount === String(v) ? '#fff' : 'var(--muted)',
                  border: '1px solid var(--border)',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Response deadline */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
            Response deadline (from now)
          </label>
          <select
            value={durationSecs}
            onChange={(e) => setDurationSecs(Number(e.target.value))}
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
            style={{
              background: 'var(--surface-muted)',
              border: '1px solid var(--border)',
              color: 'var(--ink)',
            }}
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.seconds} value={opt.seconds}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
            <span>Brief title</span>
            <span style={{ color: titleTooLong ? 'var(--danger)' : 'var(--muted)' }}>
              {titleBytes}/120 bytes
            </span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Logo design for new product launch"
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
            style={{
              background: 'var(--surface-muted)',
              border: `1px solid ${titleTooLong ? 'var(--danger)' : 'var(--border)'}`,
              color: 'var(--ink)',
            }}
          />
        </div>

        {/* Brief text → hash */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
            Brief text
          </label>
          <p className="mb-2 text-xs" style={{ color: 'var(--subtle)' }}>
            The keccak256 hash of this text is stored onchain. Share the full text with your applicant off-platform.
          </p>
          <textarea
            value={briefText}
            onChange={(e) => setBriefText(e.target.value)}
            rows={5}
            placeholder="Describe the project, deliverables, format, and any requirements…"
            className="w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none"
            style={{
              background: 'var(--surface-muted)',
              border: '1px solid var(--border)',
              color: 'var(--ink)',
            }}
          />
          {/* Live hash preview — uses the single hashText helper */}
          {briefHashPreview && (
            <p className="mono mt-1.5 text-xs break-all" style={{ color: 'var(--subtle)' }}>
              Hash: {briefHashPreview}
            </p>
          )}
        </div>

        {/* Error */}
        {(formError || writeError) && (
          <div
            className="rounded-2xl px-4 py-3 text-sm"
            style={{ background: 'rgba(186,43,76,0.08)', border: '1px solid rgba(186,43,76,0.15)', color: 'var(--danger)' }}
          >
            {formError || parseContractError(writeError)}
          </div>
        )}

        {/* Submit / switch chain */}
        {wrongChain ? (
          <button
            type="button"
            disabled={isSwitching}
            onClick={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {isSwitching ? 'Switching…' : 'Switch to Arc Testnet'}
          </button>
        ) : (
          <button
            type="submit"
            disabled={!isConnected || isPending || isConfirming}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {!isConnected
              ? 'Connect wallet to post'
              : isPending
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirm in wallet…</span>
              : isConfirming
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirming…</span>
              : `Lock ${bondAmount || '—'} USDC bond and post brief`}
          </button>
        )}
      </form>
    </div>
  )
}
