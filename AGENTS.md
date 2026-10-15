# NoGhost Bond

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

A freelance trust bond on Arc. To post a speculative brief, the client locks a USDC bond naming one applicant and a response deadline. If the client records an action (Hired/Declined/Closed) onchain before the deadline, the bond returns in full. If the deadline passes with no client action and the applicant submitted a work hash before the deadline, the applicant can claim the bond via claimGhost. After deadline + 30 days, the client can reclaim via reclaimStale.

## Contract

- Name: BriefBond
- Source: contracts/BriefBond.sol
- Tests: contracts/test/BriefBond.t.sol (33 tests, all pass)

### Deployments

- **Arc Mainnet (production)** — the deployment the frontend in `src/` is wired to
  - Address: 0x3b15d9CE9dF3FDdD073BEb58F5baF6FD277E386F
  - Chain: Arc Mainnet (Chain ID: 5042)
  - Explorer: https://explorer.arc.io/address/0x3b15d9CE9dF3FDdD073BEb58F5baF6FD277E386F
- **Arc Testnet (Studio deployment)** — the original Arc Studio deployment
  - Address: 0xe9a06cdba9078aaa6dfa3b2525b06127cc497b56
  - Chain: Arc Testnet (Chain ID: 5042002)
  - Explorer: https://explorer.testnet.arc.io/address/0xe9a06cdba9078aaa6dfa3b2525b06127cc497b56

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Mainnet (Chain ID: 5042, defined via viem `defineChain` in `src/config.ts`). Arc Testnet (Chain ID: 5042002) was the original Studio deployment chain.
- Token: USDC — native gas token at 18 decimals; ERC-20 interface at 6 decimals (Address: 0x3600000000000000000000000000000000000000, same address on Arc Mainnet and Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
