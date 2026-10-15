import { useState } from 'react'
import { Header } from './components/Header'
import { PostBrief } from './components/PostBrief'
import { BriefPage } from './components/BriefPage'
import { Registry } from './components/Registry'

type View = 'registry' | 'post' | 'brief'

export default function App() {
  const [view, setView] = useState<View>('registry')
  const [selectedBriefId, setSelectedBriefId] = useState<bigint>(0n)

  function handleBriefClick(id: bigint) {
    setSelectedBriefId(id)
    setView('brief')
  }

  function handleBriefPosted(_id: bigint) {
    setView('registry')
  }

  function handleNav(v: 'registry' | 'post') {
    setView(v)
  }

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      <Header view={view === 'brief' ? 'brief' : view} onNav={handleNav} />

      <main>
        {view === 'registry' && (
          <Registry onBriefClick={handleBriefClick} />
        )}
        {view === 'post' && (
          <PostBrief onBriefPosted={handleBriefPosted} />
        )}
        {view === 'brief' && selectedBriefId > 0n && (
          <BriefPage briefId={selectedBriefId} onBack={() => setView('registry')} />
        )}
      </main>
    </div>
  )
}
