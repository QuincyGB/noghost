# BriefBond.sol — Security Review
**Date:** 2026-10-15  
**File reviewed:** `contracts/BriefBond.sol`  
**Commit state:** post boundary-fix (strict `< deadline` semantics accepted 2026-10-15)  
**Test suite:** 49 / 49 passing (33 spec tests + 16 edge-case tests)  
**Fixes applied:** 0 — contract passed every check as-is.

---

## 1. Reentrancy

**Claim:** every exit function sets `b.status` away from `Open` before its native transfer; no recipient callback can trigger a second payout on the same brief.

### Trace — `clientAction` (lines 141–151)
```
amount  = b.bond;          // read before any mutation
b.status         = Resolved   // ← status flip FIRST
b.actionRecorded = true        // ← state fully committed
b.action         = action      //
client  = b.client;            // address snapshotted after state change
emit BriefResolved(...)        // events after state, before call
emit BondReturned(...)
client.call{value: amount}     // ← external call LAST
```

### Trace — `claimGhost` (lines 165–174)
```
amount    = b.bond;
wh        = b.workHash;
applicant = b.applicant;
b.status = Forfeited           // ← status flip FIRST
emit GhostClaimed(...)
emit BondForfeited(...)
applicant.call{value: amount}  // ← external call LAST
```

### Trace — `reclaimStale` (lines 185–192)
```
amount = b.bond;
client = b.client;
b.status = Reclaimed           // ← status flip FIRST
emit BondReclaimed(...)
client.call{value: amount}     // ← external call LAST
```

**Re-entry scenario (same brief):** if a recipient's `receive()` re-enters any exit function using the same `briefId`, the guard `b.status != BriefStatus.Open` → `BriefNotOpen` reverts the inner call before any state is read. The outer call already flipped the status, so the bond is paid exactly once.

**Re-entry scenario (different briefId):** each brief holds its own bond and its own status slot in the `briefs` mapping. A re-entrant call on brief B while brief A's transfer is in flight touches a completely independent storage cell; no cross-brief leakage is possible.

**Note on event ordering:** events are emitted between the state change and the external call (`state → emit → .call`). This is valid CEI — the state is already mutated before the external call, so the reentrancy protection holds regardless of the emit position.

**Verdict: PASS — no reentrancy vector exists.**

---

## 2. Payout destinations

**Claim:** only `brief.client` (clientAction, reclaimStale) and `brief.applicant` (claimGhost) receive native value. No payout function accepts an address parameter.

### Complete inventory of native-value transfers

| Line | Function | Destination expression | Amount |
|------|----------|----------------------|--------|
| 150 | `clientAction` | `client` (local copy of `b.client`) | `b.bond` |
| 173 | `claimGhost` | `applicant` (local copy of `b.applicant`) | `b.bond` |
| 191 | `reclaimStale` | `client` (local copy of `b.client`) | `b.bond` |

No other `.call{value:}`, `.transfer()`, `.send()`, or `selfdestruct` anywhere in the file. No `payable(x).transfer` pattern.

**Destination immutability:** `b.client` and `b.applicant` are written once in `postBrief` (lines 102–103) and are never assigned again anywhere in the contract. A re-entrant storage write cannot redirect the payout because the status flip has already happened before the `.call`, blocking any write path that checks `BriefNotOpen`.

**Function signatures (no address parameter):**
- `clientAction(uint256, ClientAction)` — no address
- `claimGhost(uint256)` — no address
- `reclaimStale(uint256)` — no address

**Verdict: PASS — exactly three transfer sites, destinations fixed at post time, no address parameters.**

---

## 3. Access control

**Claim:** `clientAction` and `reclaimStale` are impossible for any address other than `brief.client`; `submitWork` and `claimGhost` are impossible for any address other than `brief.applicant`.

### Guards

| Function | Guard | Error |
|----------|-------|-------|
| `clientAction` | `msg.sender != b.client` | `NotClient` |
| `reclaimStale` | `msg.sender != b.client` | `NotClient` |
| `submitWork` | `msg.sender != b.applicant` | `NotApplicant` |
| `claimGhost` | `msg.sender != b.applicant` | `NotApplicant` |

### Why the applicant cannot pass a `NotClient` guard

`postBrief` enforces `applicant != msg.sender` (`ApplicantIsClient` revert, line 91). `b.client` and `b.applicant` are written from those two distinct values and are never modified. Therefore `b.client != b.applicant` is a contract invariant for every brief that was successfully posted; the applicant can never equal the client.

### Why the client cannot pass a `NotApplicant` guard

Same invariant in reverse: `b.applicant != b.client`, so the client address never satisfies `msg.sender == b.applicant`.

### Stranger case

A stranger is neither `b.client` nor `b.applicant` and fails all four guards.

**Verdict: PASS — access control is complete and non-bypassable.**

---

## 4. Claim integrity

**Claim:** `claimGhost` reads the work hash from stored state only; there is no way to make a brief claimable with a hash first presented after its deadline.

### Write path for `workHash`

The only assignment to `b.workHash` is in `submitWork` (line 127):
```solidity
b.workHash = workHash;
b.workSubmittedAt = block.timestamp;
```
`submitWork` requires `block.timestamp < b.deadline` (strict, line 124: `if (block.timestamp >= b.deadline) revert DeadlinePassed()`). Therefore every value ever written to `b.workHash` was written at a timestamp strictly less than `b.deadline`, and `b.workSubmittedAt` records that timestamp.

### Read path in `claimGhost`

```solidity
if (b.workHash == bytes32(0)) revert NoWorkRecorded();         // must exist
if (b.workSubmittedAt >= b.deadline) revert WorkSubmittedLate(); // belt-and-suspenders
bytes32 wh = b.workHash;   // read from storage — the applicant supplies no hash
```

`claimGhost` takes no `workHash` parameter. The hash used for the event and the payout decision is the one already in storage. An adversary cannot supply a new hash at claim time.

### Belt-and-suspenders analysis

The `WorkSubmittedLate` check on line 163 is technically redundant because `submitWork` already prevents any write at or after the deadline. It is not harmful — it acts as a defence-in-depth guard against any future code path that might bypass `submitWork`'s timestamp check. Removing it would not open a vulnerability, but keeping it costs only gas on the revert path and documents the invariant explicitly.

**Verdict: PASS — hash integrity is enforced at write time and double-checked at claim time.**

---

## 5. Admin surface

**Claim:** no owner, no setter, no pause, no cancel, no upgrade, no proxy.

### Full function inventory

| Function | Visibility | Mutates state? | Notes |
|----------|-----------|----------------|-------|
| `postBrief` | external payable | yes — creates a Brief | user-accessible |
| `submitWork` | external | yes — writes workHash/workSubmittedAt | user-accessible |
| `clientAction` | external | yes — resolves brief, transfers bond | role-gated to client |
| `claimGhost` | external | yes — forfeits brief, transfers bond | role-gated to applicant |
| `reclaimStale` | external | yes — reclaims brief, transfers bond | role-gated to client |
| `getBrief` | external view | no | pure read |
| `constructor` | — | sets `nextBriefId = 1` | no owner address stored |

No `owner` state variable. No `Ownable` or similar import. No `onlyOwner` modifier. No `pause`, `unpause`, `Pausable`. No `setApplicant`, `setDeadline`, `extend`, `cancel`, `withdraw` functions. No `upgradeTo`, `implementation`, `initialize`, `_setImplementation`, EIP-1967 storage slots, or transparent/UUPS proxy patterns. No `selfdestruct`.

The constructor stores nothing privileged — it only advances `nextBriefId` to 1 so the first briefId is not zero.

**Verdict: PASS — zero admin surface.**

---

## Summary

| Category | Finding | Action |
|----------|---------|--------|
| 1. Reentrancy | CEI strictly enforced in all three exit functions; status flips before every transfer; re-entry blocked by `BriefNotOpen` | None required |
| 2. Payout destinations | Exactly three transfer sites; all destinations are immutable brief fields; no address parameters on exit functions | None required |
| 3. Access control | Four role guards covering all combinations; client ≠ applicant invariant enforced at post time | None required |
| 4. Claim integrity | Hash written only by `submitWork` which enforces `< deadline`; `claimGhost` reads only stored state | None required |
| 5. Admin surface | Zero: no owner, no setter, no pause, no upgrade, no proxy | None required |

**No fixes applied. Contract is clean across all five categories.**

---

## Test confirmation

```
Suite result: ok. 49 passed; 0 failed; 0 skipped
Finished in 22.51ms (43.12ms CPU time)
```

All 49 tests (33 spec + 16 edge-case) pass against the unmodified contract.
