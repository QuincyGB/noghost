# NoGhost Bond

**Get ghosted, get paid.** A client-side USDC bond that makes ghosting on spec-work briefs expensive — built with Arc Studio, live on Arc mainnet.

## The problem

Clients request spec work or off-platform contact from freelancers, then vanish. No contract, no reply, no recourse — the freelancer's loss is unpaid time, and it happens constantly on every gig platform.

NoGhost flips who posts the trust. Before a brief can ask for unpaid sample work, the *client* puts money down.

## How it works

- **The client locks a bond to post the brief.** Posting a brief that requests spec work requires locking a USDC bond (1–1,000 USDC) in the `BriefBond` contract, naming **one** applicant and a response deadline.
- **Any client action before the deadline returns the bond in full.** If the client records an action onchain — Hired, Declined, or Closed — the bond comes straight back. A decision, even a no, honours the brief.
- **Ghosting pays the applicant.** If the deadline passes with no client action and the applicant recorded a work hash before the deadline, the applicant claims the bond with `claimGhost`. Pure timeout — no arbiter, no oracle, no support ticket.

Edge case: if nobody ever claims, the client can reclaim the bond after deadline + 30 days (`reclaimStale`).

## Design constraints

- **Native USDC only** — the contract holds and moves Arc's native USDC; there are no ERC-20 transfers anywhere in it.
- **No owner, no admin keys, no setters, no upgrade path.** The rules in the deployed bytecode are the rules forever.
- **49/49 Foundry tests passing**, including strict-deadline boundary tests: the deadline is strict, so work submissions and client actions must land *before* the deadline second.
- Bond range 1–1,000 USDC; brief duration 1 hour to 90 days; one named applicant per brief.

## Deployments

| | |
|---|---|
| **Arc Mainnet** (chain 5042) | BriefBond `0x3b15d9CE9dF3FDdD073BEb58F5baF6FD277E386F` — [explorer](https://explorer.arc.io/address/0x3b15d9CE9dF3FDdD073BEb58F5baF6FD277E386F) |
| **Live app** | https://noghost-pied.vercel.app |
| **Arc Studio project** | https://studio.arc.io/app/1547a3da-6adc-4401-9fa2-2468441dd891 |
| **Studio testnet deployment** (Arc Testnet 5042002) | `0xe9a06cdba9078aaa6dfa3b2525b06127cc497b56` |

## Mainnet proof

Test-scale proof run (1 USDC bonds), Oct 15 2026 — full-size run follows. Brief #1 is a real brief (a sponsor media-kit design brief for an independent NFL highlights property) run through the complete happy path:

- **postBrief** — client locks the bond: https://explorer.arc.io/tx/0x7e613189c5cac715555578741f8c2dee9d41ecaf1436b1042c6dfefc951b33c8
- **submitWork** — applicant records the work hash before the deadline: https://explorer.arc.io/tx/0x12b8f7825da81614e568f3f8414086cfe0dd7fbb8ac6ee34e3935726949ae224
- **clientAction (Hired)** — bond returned to the client in full: https://explorer.arc.io/tx/0x13f210dff88066269819ec3095152ebd40f690824f2e665b632f5acfbb01f540

Brief #2 is a clearly titled onchain **SIMULATION** of the ghost path (same contract, team-operated on both sides, disclosed here and in its onchain title) demonstrating the `claimGhost` forfeiture; its claim transaction will be added here after it executes.

## How it was built

The entire project was generated and iterated inside **Arc Studio** from natural-language prompts: the `BriefBond` contract, the 49-test Foundry suite, a security review pass (see `docs/security-review-briefbond.md`), and the four-view React frontend (post a brief, brief page with live countdown and role-gated actions, public registry, header). Arc Studio deploys to testnet only, so the audited Studio export was deployed to Arc mainnet **unmodified** and the frontend re-pointed at the mainnet deployment (chain configuration only — contract bytecode untouched).

## Run it

```bash
bun install
bun run dev        # frontend
forge build        # contracts (foundry.toml is preconfigured, solc 0.8.28)
forge test         # 49 tests
```

## License

MIT — see [LICENSE](LICENSE).
