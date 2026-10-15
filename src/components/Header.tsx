import { ConnectKitButton } from 'connectkit'
import { ShieldCheck } from 'lucide-react'

interface HeaderProps {
  view: 'registry' | 'post' | 'brief'
  onNav: (v: 'registry' | 'post') => void
}

export function Header({ view, onNav }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        {/* Brand */}
        <button
          className="flex items-center gap-2 text-left"
          onClick={() => onNav('registry')}
        >
          <div
            className="flex size-8 items-center justify-center rounded-xl"
            style={{ background: 'var(--accent)' }}
          >
            <ShieldCheck className="size-4 text-white" />
          </div>
          <div>
            <div className="display text-sm font-700 leading-tight" style={{ color: 'var(--ink)' }}>
              NoGhost Bond
            </div>
            <div className="text-xs leading-tight" style={{ color: 'var(--muted)' }}>
              freelance briefs, minus the ghosting
            </div>
          </div>
        </button>

        {/* Nav + connect */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNav('registry')}
            className="hidden text-xs font-semibold sm:block"
            style={{ color: view === 'registry' ? 'var(--accent)' : 'var(--muted)' }}
          >
            Registry
          </button>
          <button
            onClick={() => onNav('post')}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              background: view === 'post' ? 'var(--accent)' : 'var(--surface-muted)',
              color: view === 'post' ? '#fff' : 'var(--ink-2)',
            }}
          >
            Post a brief
          </button>
          <ConnectKitButton />
        </div>
      </div>

      {/* Rule line */}
      <div
        className="border-t px-4 py-1.5 text-center text-xs"
        style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
      >
        A client locks USDC when they ask for sample work. Reply by the deadline and it all comes back. Disappear, and the freelancer who did the work claims it.
      </div>
    </header>
  )
}
