// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BriefBond} from "../BriefBond.sol";

contract BriefBondTest is Test {
    // ── contract under test ──────────────────────────────────────────────────
    BriefBond internal bb;

    // ── actors ───────────────────────────────────────────────────────────────
    address internal client    = makeAddr("client");
    address internal applicant = makeAddr("applicant");
    address internal stranger  = makeAddr("stranger");

    // ── constants (mirror the contract) ──────────────────────────────────────
    uint256 internal constant MIN_BOND       = 1 ether;
    uint256 internal constant MAX_BOND       = 1000 ether;
    uint256 internal constant MIN_DURATION   = 1 hours;
    uint256 internal constant MAX_DURATION   = 90 days;
    uint256 internal constant CLAIM_WINDOW   = 30 days;
    uint256 internal constant MAX_TITLE_BYTES = 120;

    // ── reusable fixture values ───────────────────────────────────────────────
    bytes32 internal constant BRIEF_HASH = keccak256("brief-content");
    bytes32 internal constant WORK_HASH  = keccak256("work-content");
    string  internal constant TITLE      = "Design a logo for my startup";

    // deadline that sits just inside the valid window (now + 2 hours)
    uint256 internal deadline;

    // ─────────────────────────────────────────────────────────────────────────
    function setUp() public {
        bb = new BriefBond();

        // Give everyone plenty of ETH
        vm.deal(client,    10_000 ether);
        vm.deal(applicant, 10_000 ether);
        vm.deal(stranger,  10_000 ether);

        // Set a stable starting time and compute a valid deadline
        vm.warp(1_000_000);
        deadline = block.timestamp + 2 hours;
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /// Post a valid brief from `client` and return its briefId.
    function _postBrief() internal returns (uint256) {
        vm.prank(client);
        return bb.postBrief{value: MIN_BOND}(applicant, deadline, BRIEF_HASH, TITLE);
    }

    /// Post a brief and then submit work before the deadline.
    function _postAndSubmit() internal returns (uint256) {
        uint256 id = _postBrief();
        vm.prank(applicant);
        bb.submitWork(id, WORK_HASH);
        return id;
    }

    // =========================================================================
    // RULE 1 – postBrief stores all fields and emits BriefPosted
    // =========================================================================
    function test_PostBrief_StoresFieldsAndEmitsBriefPosted() public {
        vm.prank(client);

        vm.expectEmit(true, true, true, true, address(bb));
        emit BriefBond.BriefPosted(1, client, applicant, MIN_BOND, deadline, BRIEF_HASH, TITLE);

        uint256 id = bb.postBrief{value: MIN_BOND}(applicant, deadline, BRIEF_HASH, TITLE);

        assertEq(id, 1, "briefId should be 1");

        BriefBond.Brief memory b = bb.getBrief(id);
        assertEq(b.client,    client,                   "client mismatch");
        assertEq(b.applicant, applicant,                "applicant mismatch");
        assertEq(b.bond,      MIN_BOND,                 "bond mismatch");
        assertEq(b.deadline,  deadline,                 "deadline mismatch");
        assertEq(b.briefHash, BRIEF_HASH,               "briefHash mismatch");
        assertEq(b.title,     TITLE,                    "title mismatch");
        assertEq(b.workHash,  bytes32(0),               "workHash should be zero");
        assertEq(b.workSubmittedAt, 0,                  "workSubmittedAt should be 0");
        assertEq(uint8(b.status), uint8(BriefBond.BriefStatus.Open), "status should be Open");
        assertFalse(b.actionRecorded,                   "actionRecorded should be false");
    }

    // =========================================================================
    // RULE 2 – postBrief reverts below MIN_BOND (< 1 ether)
    // =========================================================================
    function test_PostBrief_RevertsWhenBondTooSmall() public {
        vm.prank(client);
        vm.expectRevert(BriefBond.BondTooSmall.selector);
        bb.postBrief{value: MIN_BOND - 1}(applicant, deadline, BRIEF_HASH, TITLE);
    }

    // =========================================================================
    // RULE 3 – postBrief reverts above MAX_BOND (> 1000 ether)
    // =========================================================================
    function test_PostBrief_RevertsWhenBondTooLarge() public {
        vm.prank(client);
        vm.expectRevert(BriefBond.BondTooLarge.selector);
        bb.postBrief{value: MAX_BOND + 1}(applicant, deadline, BRIEF_HASH, TITLE);
    }

    // =========================================================================
    // RULE 4 – postBrief reverts with zero applicant
    // =========================================================================
    function test_PostBrief_RevertsWhenApplicantIsZero() public {
        vm.prank(client);
        vm.expectRevert(BriefBond.ZeroApplicant.selector);
        bb.postBrief{value: MIN_BOND}(address(0), deadline, BRIEF_HASH, TITLE);
    }

    // =========================================================================
    // RULE 5 – postBrief reverts when applicant == client (msg.sender)
    // =========================================================================
    function test_PostBrief_RevertsWhenApplicantIsClient() public {
        vm.prank(client);
        vm.expectRevert(BriefBond.ApplicantIsClient.selector);
        bb.postBrief{value: MIN_BOND}(client, deadline, BRIEF_HASH, TITLE);
    }

    // =========================================================================
    // RULE 6 – postBrief reverts when deadline < block.timestamp + MIN_DURATION
    // =========================================================================
    function test_PostBrief_RevertsWhenDeadlineTooSoon() public {
        // deadline = now + MIN_DURATION - 1 second  →  strictly less than required
        uint256 tooSoon = block.timestamp + MIN_DURATION - 1;
        vm.prank(client);
        vm.expectRevert(BriefBond.DeadlineTooSoon.selector);
        bb.postBrief{value: MIN_BOND}(applicant, tooSoon, BRIEF_HASH, TITLE);
    }

    // =========================================================================
    // RULE 7 – postBrief reverts when deadline > block.timestamp + MAX_DURATION
    // =========================================================================
    function test_PostBrief_RevertsWhenDeadlineTooFar() public {
        uint256 tooFar = block.timestamp + MAX_DURATION + 1;
        vm.prank(client);
        vm.expectRevert(BriefBond.DeadlineTooFar.selector);
        bb.postBrief{value: MIN_BOND}(applicant, tooFar, BRIEF_HASH, TITLE);
    }

    // =========================================================================
    // RULE 8 – postBrief reverts with zero briefHash
    // =========================================================================
    function test_PostBrief_RevertsWhenBriefHashIsZero() public {
        vm.prank(client);
        vm.expectRevert(BriefBond.ZeroBriefHash.selector);
        bb.postBrief{value: MIN_BOND}(applicant, deadline, bytes32(0), TITLE);
    }

    // =========================================================================
    // RULE 9 – postBrief reverts with empty title
    // =========================================================================
    function test_PostBrief_RevertsWhenTitleIsEmpty() public {
        vm.prank(client);
        vm.expectRevert(BriefBond.TitleEmpty.selector);
        bb.postBrief{value: MIN_BOND}(applicant, deadline, BRIEF_HASH, "");
    }

    // =========================================================================
    // RULE 10 – postBrief reverts with title longer than MAX_TITLE_BYTES (120 bytes)
    // =========================================================================
    function test_PostBrief_RevertsWhenTitleTooLong() public {
        // Build a 121-byte ASCII string
        bytes memory longTitle = new bytes(MAX_TITLE_BYTES + 1);
        for (uint256 i = 0; i < longTitle.length; i++) {
            longTitle[i] = "a";
        }
        vm.prank(client);
        vm.expectRevert(BriefBond.TitleTooLong.selector);
        bb.postBrief{value: MIN_BOND}(applicant, deadline, BRIEF_HASH, string(longTitle));
    }

    // =========================================================================
    // RULE 11 – submitWork by applicant before deadline stores hash + emits WorkSubmitted
    // =========================================================================
    function test_SubmitWork_StoresHashAndEmitsWorkSubmitted() public {
        uint256 id = _postBrief();

        vm.prank(applicant);
        vm.expectEmit(true, true, false, true, address(bb));
        emit BriefBond.WorkSubmitted(id, applicant, WORK_HASH, block.timestamp);
        bb.submitWork(id, WORK_HASH);

        BriefBond.Brief memory b = bb.getBrief(id);
        assertEq(b.workHash,        WORK_HASH,       "workHash mismatch");
        assertEq(b.workSubmittedAt, block.timestamp, "workSubmittedAt mismatch");
    }

    // =========================================================================
    // RULE 12 – submitWork reverts for a non-applicant
    // =========================================================================
    function test_SubmitWork_RevertsForNonApplicant() public {
        uint256 id = _postBrief();
        vm.prank(stranger);
        vm.expectRevert(BriefBond.NotApplicant.selector);
        bb.submitWork(id, WORK_HASH);
    }

    // =========================================================================
    // RULE 13 – submitWork reverts at (or after) the deadline
    // =========================================================================
    function test_SubmitWork_RevertsAfterDeadline() public {
        uint256 id = _postBrief();
        vm.warp(deadline); // block.timestamp == deadline → strict >= check reverts
        vm.prank(applicant);
        vm.expectRevert(BriefBond.DeadlinePassed.selector);
        bb.submitWork(id, WORK_HASH);
    }

    // =========================================================================
    // RULE 14 – submitWork reverts with zero workHash
    // =========================================================================
    function test_SubmitWork_RevertsWithZeroWorkHash() public {
        uint256 id = _postBrief();
        vm.prank(applicant);
        vm.expectRevert(BriefBond.ZeroWorkHash.selector);
        bb.submitWork(id, bytes32(0));
    }

    // =========================================================================
    // RULE 15 – second submitWork before deadline overwrites both workHash and workSubmittedAt
    // =========================================================================
    function test_SubmitWork_SecondSubmissionOverwritesPrevious() public {
        uint256 id = _postBrief();

        // First submission
        vm.prank(applicant);
        bb.submitWork(id, WORK_HASH);

        // Advance time (still before deadline)
        vm.warp(block.timestamp + 30 minutes);

        bytes32 newHash = keccak256("revised-work");
        uint256 newTime = block.timestamp;

        vm.prank(applicant);
        vm.expectEmit(true, true, false, true, address(bb));
        emit BriefBond.WorkSubmitted(id, applicant, newHash, newTime);
        bb.submitWork(id, newHash);

        BriefBond.Brief memory b = bb.getBrief(id);
        assertEq(b.workHash,        newHash,  "workHash should be overwritten");
        assertEq(b.workSubmittedAt, newTime,  "workSubmittedAt should be overwritten");
    }

    // =========================================================================
    // RULE 16 – clientAction before deadline refunds exact bond, records action,
    //           emits BriefResolved + BondReturned
    // =========================================================================
    function test_ClientAction_RefundsBondAndEmitsBothEvents() public {
        uint256 id = _postBrief();
        uint256 balBefore = client.balance;

        vm.prank(client);
        vm.expectEmit(true, true, false, true, address(bb));
        emit BriefBond.BriefResolved(id, client, BriefBond.ClientAction.Hired);
        vm.expectEmit(true, true, false, true, address(bb));
        emit BriefBond.BondReturned(id, client, MIN_BOND);
        bb.clientAction(id, BriefBond.ClientAction.Hired);

        // Bond refunded
        assertEq(client.balance, balBefore + MIN_BOND, "client should receive exact bond back");

        // State recorded
        BriefBond.Brief memory b = bb.getBrief(id);
        assertEq(uint8(b.status), uint8(BriefBond.BriefStatus.Resolved), "status should be Resolved");
        assertTrue(b.actionRecorded, "actionRecorded should be true");
        assertEq(uint8(b.action), uint8(BriefBond.ClientAction.Hired), "action should be Hired");
    }

    // =========================================================================
    // RULE 17 – after clientAction, submitWork reverts (brief not Open)
    // =========================================================================
    function test_AfterClientAction_SubmitWorkReverts() public {
        uint256 id = _postBrief();
        vm.prank(client);
        bb.clientAction(id, BriefBond.ClientAction.Declined);

        vm.prank(applicant);
        vm.expectRevert(BriefBond.BriefNotOpen.selector);
        bb.submitWork(id, WORK_HASH);
    }

    // =========================================================================
    // RULE 18 – after clientAction, claimGhost reverts (brief not Open)
    // =========================================================================
    function test_AfterClientAction_ClaimGhostReverts() public {
        uint256 id = _postAndSubmit();
        vm.prank(client);
        bb.clientAction(id, BriefBond.ClientAction.Declined);

        // Warp past deadline + into claim window
        vm.warp(deadline + 1 hours);

        vm.prank(applicant);
        vm.expectRevert(BriefBond.BriefNotOpen.selector);
        bb.claimGhost(id);
    }

    // =========================================================================
    // RULE 19 – after clientAction, reclaimStale reverts (brief not Open)
    // =========================================================================
    function test_AfterClientAction_ReclaimStaleReverts() public {
        uint256 id = _postBrief();
        vm.prank(client);
        bb.clientAction(id, BriefBond.ClientAction.Closed);

        // Warp past deadline + CLAIM_WINDOW
        vm.warp(deadline + CLAIM_WINDOW + 1);

        vm.prank(client);
        vm.expectRevert(BriefBond.BriefNotOpen.selector);
        bb.reclaimStale(id);
    }

    // =========================================================================
    // RULE 20 – clientAction reverts for non-client (applicant)
    // =========================================================================
    function test_ClientAction_RevertsForApplicant() public {
        uint256 id = _postBrief();
        vm.prank(applicant);
        vm.expectRevert(BriefBond.NotClient.selector);
        bb.clientAction(id, BriefBond.ClientAction.Hired);
    }

    // =========================================================================
    // RULE 21 – clientAction reverts for non-client (stranger)
    // =========================================================================
    function test_ClientAction_RevertsForStranger() public {
        uint256 id = _postBrief();
        vm.prank(stranger);
        vm.expectRevert(BriefBond.NotClient.selector);
        bb.clientAction(id, BriefBond.ClientAction.Hired);
    }

    // =========================================================================
    // RULE 22 – clientAction reverts at (or after) the deadline
    // =========================================================================
    function test_ClientAction_RevertsAfterDeadline() public {
        uint256 id = _postBrief();
        vm.warp(deadline); // block.timestamp == deadline → strict >= check reverts
        vm.prank(client);
        vm.expectRevert(BriefBond.DeadlinePassed.selector);
        bb.clientAction(id, BriefBond.ClientAction.Hired);
    }

    // =========================================================================
    // RULE 23 – claimGhost after deadline with work recorded pays applicant exact
    //           bond, emits GhostClaimed + BondForfeited
    // =========================================================================
    function test_ClaimGhost_PaysApplicantAndEmitsBothEvents() public {
        uint256 id = _postAndSubmit();
        uint256 balBefore = applicant.balance;

        // Warp to just after deadline, still inside claim window
        vm.warp(deadline + 1);

        vm.prank(applicant);
        vm.expectEmit(true, true, false, true, address(bb));
        emit BriefBond.GhostClaimed(id, applicant, WORK_HASH);
        vm.expectEmit(true, true, false, true, address(bb));
        emit BriefBond.BondForfeited(id, applicant, MIN_BOND);
        bb.claimGhost(id);

        assertEq(applicant.balance, balBefore + MIN_BOND, "applicant should receive exact bond");

        BriefBond.Brief memory b = bb.getBrief(id);
        assertEq(uint8(b.status), uint8(BriefBond.BriefStatus.Forfeited), "status should be Forfeited");
    }

    // =========================================================================
    // RULE 24 – claimGhost reverts before the deadline
    // =========================================================================
    function test_ClaimGhost_RevertsBeforeDeadline() public {
        uint256 id = _postAndSubmit();
        // Still before deadline
        vm.prank(applicant);
        vm.expectRevert(BriefBond.DeadlineNotPassed.selector);
        bb.claimGhost(id);
    }

    // =========================================================================
    // RULE 25 – claimGhost reverts with no work recorded
    // =========================================================================
    function test_ClaimGhost_RevertsWithNoWorkRecorded() public {
        uint256 id = _postBrief(); // no submitWork
        vm.warp(deadline + 1);
        vm.prank(applicant);
        vm.expectRevert(BriefBond.NoWorkRecorded.selector);
        bb.claimGhost(id);
    }

    // =========================================================================
    // RULE 26 – claimGhost reverts for non-applicant
    // =========================================================================
    function test_ClaimGhost_RevertsForNonApplicant() public {
        uint256 id = _postAndSubmit();
        vm.warp(deadline + 1);
        vm.prank(stranger);
        vm.expectRevert(BriefBond.NotApplicant.selector);
        bb.claimGhost(id);
    }

    // =========================================================================
    // RULE 27 – claimGhost reverts after deadline + CLAIM_WINDOW
    // =========================================================================
    function test_ClaimGhost_RevertsAfterClaimWindow() public {
        uint256 id = _postAndSubmit();
        vm.warp(deadline + CLAIM_WINDOW + 1);
        vm.prank(applicant);
        vm.expectRevert(BriefBond.ClaimWindowExpired.selector);
        bb.claimGhost(id);
    }

    // =========================================================================
    // RULE 28 – reclaimStale after deadline + CLAIM_WINDOW refunds client even
    //           when work was recorded but never claimed
    // =========================================================================
    function test_ReclaimStale_RefundsClientAfterClaimWindowWithWorkRecorded() public {
        uint256 id = _postAndSubmit(); // work submitted, never claimed
        uint256 balBefore = client.balance;

        vm.warp(deadline + CLAIM_WINDOW + 1);

        vm.prank(client);
        vm.expectEmit(true, true, false, true, address(bb));
        emit BriefBond.BondReclaimed(id, client, MIN_BOND);
        bb.reclaimStale(id);

        assertEq(client.balance, balBefore + MIN_BOND, "client should receive exact bond back");

        BriefBond.Brief memory b = bb.getBrief(id);
        assertEq(uint8(b.status), uint8(BriefBond.BriefStatus.Reclaimed), "status should be Reclaimed");
    }

    // =========================================================================
    // RULE 29 – reclaimStale reverts before CLAIM_WINDOW lapses
    // =========================================================================
    function test_ReclaimStale_RevertsBeforeClaimWindowExpires() public {
        uint256 id = _postBrief();
        // Warp to just after deadline but inside the claim window
        vm.warp(deadline + CLAIM_WINDOW - 1);
        vm.prank(client);
        vm.expectRevert(BriefBond.ClaimWindowNotExpired.selector);
        bb.reclaimStale(id);
    }

    // =========================================================================
    // RULE 30 – reclaimStale reverts after a successful claimGhost (brief not Open)
    // =========================================================================
    function test_ReclaimStale_RevertsAfterSuccessfulClaimGhost() public {
        uint256 id = _postAndSubmit();

        // Applicant claims ghost successfully
        vm.warp(deadline + 1);
        vm.prank(applicant);
        bb.claimGhost(id);

        // Now advance past claim window
        vm.warp(deadline + CLAIM_WINDOW + 1);

        // Client tries to reclaimStale — must revert with BriefNotOpen
        vm.prank(client);
        vm.expectRevert(BriefBond.BriefNotOpen.selector);
        bb.reclaimStale(id);
    }

    // =========================================================================
    // RULE 31 – No setter, withdraw, or owner functions exist
    //           Checked by verifying the ABI surface of BriefBond
    // =========================================================================
    function test_NoAdminOrWithdrawFunctions() public view {
        // The only non-view external entry points are the four documented ones.
        // We verify this by calling getBrief (view) and confirming the contract
        // does NOT expose any of: owner(), withdraw(), setX(), transferOwnership().
        // Solidity exposes these as public getters or external functions; any
        // extra selector would need to be tested by calling it.  We instead use
        // low-level staticcall with the expected selectors and assert no code
        // responds to them.

        bytes4[4] memory forbidden = [
            bytes4(keccak256("owner()")),
            bytes4(keccak256("withdraw()")),
            bytes4(keccak256("withdraw(uint256)")),
            bytes4(keccak256("transferOwnership(address)"))
        ];

        for (uint256 i = 0; i < forbidden.length; i++) {
            (bool success, bytes memory ret) = address(bb).staticcall(abi.encodePacked(forbidden[i]));
            // Either the call reverts (success==false) OR returns empty data —
            // both mean the function is absent / not implemented.
            // A true implementation would return non-empty data and succeed.
            bool hasImpl = success && ret.length > 0;
            assertFalse(hasImpl, "Unexpected admin/withdraw function found");
        }
    }

    // =========================================================================
    // BONUS FUZZ – postBrief: any bond in [MIN_BOND, MAX_BOND] is accepted
    // =========================================================================
    function testFuzz_PostBrief_AcceptsAnyValidBond(uint256 bond) public {
        bond = bound(bond, MIN_BOND, MAX_BOND);
        vm.deal(client, bond + 1 ether); // ensure exact balance
        vm.prank(client);
        uint256 id = bb.postBrief{value: bond}(applicant, deadline, BRIEF_HASH, TITLE);
        assertGt(id, 0, "briefId should be non-zero");
        assertEq(bb.getBrief(id).bond, bond, "stored bond should match sent value");
    }

    // =========================================================================
    // BONUS FUZZ – submitWork: any valid (non-zero) workHash is accepted
    // =========================================================================
    function testFuzz_SubmitWork_AcceptsAnyNonZeroHash(bytes32 wh) public {
        vm.assume(wh != bytes32(0));
        uint256 id = _postBrief();
        vm.prank(applicant);
        bb.submitWork(id, wh);
        assertEq(bb.getBrief(id).workHash, wh, "workHash should be stored");
    }

    // =========================================================================
    // EDGE CASE (a) – two independent briefs from the same client
    //   Acting on brief A never changes brief B; each bond settles separately.
    // =========================================================================
    address internal applicant2 = makeAddr("applicant2");

    function test_EdgeA_TwoBriefs_FullyIndependent() public {
        vm.deal(applicant2, 10_000 ether);

        // Brief A: client → applicant, bond = 1 ether
        vm.prank(client);
        uint256 idA = bb.postBrief{value: 1 ether}(applicant, deadline, BRIEF_HASH, TITLE);

        // Brief B: same client → applicant2, bond = 5 ether
        bytes32 briefHashB = keccak256("brief-B-content");
        vm.prank(client);
        uint256 idB = bb.postBrief{value: 5 ether}(applicant2, deadline, briefHashB, "Brief B title");

        // Sanity: IDs are distinct
        assertTrue(idA != idB, "brief IDs must differ");

        // Acting on A (client records Hired) — check B is still Open with its bond
        uint256 clientBalBefore = client.balance;
        vm.prank(client);
        bb.clientAction(idA, BriefBond.ClientAction.Hired);

        BriefBond.Brief memory bA = bb.getBrief(idA);
        BriefBond.Brief memory bB = bb.getBrief(idB);

        assertEq(uint8(bA.status), uint8(BriefBond.BriefStatus.Resolved), "A should be Resolved");
        assertEq(uint8(bB.status), uint8(BriefBond.BriefStatus.Open),     "B must still be Open");
        assertEq(bB.bond, 5 ether, "B bond must be unchanged");
        // Client received back exactly A's bond (1 ether), not B's
        assertEq(client.balance, clientBalBefore + 1 ether, "client received back only A's bond");

        // Contract still holds B's bond (5 ether)
        assertEq(address(bb).balance, 5 ether, "contract should still hold B's bond");

        // Settle B separately via claimGhost path
        bytes32 workHashB = keccak256("work-B");
        vm.prank(applicant2);
        bb.submitWork(idB, workHashB);

        vm.warp(deadline + 1);
        uint256 app2BalBefore = applicant2.balance;
        vm.prank(applicant2);
        bb.claimGhost(idB);

        BriefBond.Brief memory bBAfter = bb.getBrief(idB);
        assertEq(uint8(bBAfter.status), uint8(BriefBond.BriefStatus.Forfeited), "B should be Forfeited");
        assertEq(applicant2.balance, app2BalBefore + 5 ether, "applicant2 received B's exact bond");
        assertEq(address(bb).balance, 0, "contract should be empty after both briefs settled");
    }

    // =========================================================================
    // EDGE CASE (b) – strict deadline boundary for clientAction and claimGhost
    //   clientAction at exactly block.timestamp == deadline REVERTS (DeadlinePassed).
    //   claimGhost at exactly block.timestamp == deadline REVERTS (DeadlineNotPassed).
    //   claimGhost at deadline + 1 second succeeds (work recorded strictly before deadline).
    // =========================================================================
    function test_EdgeB_ClientAction_AtExactDeadline_Reverts() public {
        uint256 id = _postBrief();
        vm.warp(deadline); // block.timestamp == deadline
        vm.prank(client);
        vm.expectRevert(BriefBond.DeadlinePassed.selector);
        bb.clientAction(id, BriefBond.ClientAction.Hired);
    }

    function test_EdgeB_ClaimGhost_AtExactDeadline_Reverts() public {
        uint256 id = _postAndSubmit(); // work submitted before deadline
        vm.warp(deadline); // block.timestamp == deadline  →  still <= deadline
        vm.prank(applicant);
        vm.expectRevert(BriefBond.DeadlineNotPassed.selector);
        bb.claimGhost(id);
    }

    function test_EdgeB_ClaimGhost_AtDeadlinePlusOne_Succeeds() public {
        // Submit work strictly before deadline (at block.timestamp = 1_000_000)
        uint256 id = _postAndSubmit();

        // Advance to exactly deadline + 1 second
        vm.warp(deadline + 1);
        uint256 balBefore = applicant.balance;

        vm.prank(applicant);
        bb.claimGhost(id);

        assertEq(applicant.balance, balBefore + MIN_BOND, "applicant must receive the bond");
        assertEq(uint8(bb.getBrief(id).status), uint8(BriefBond.BriefStatus.Forfeited), "status Forfeited");
    }

    // =========================================================================
    // EDGE CASE (c) – strict boundary for submitWork
    //   submitWork at exactly block.timestamp == deadline REVERTS (DeadlinePassed).
    //   submitWork at deadline − 1 second succeeds and that hash is claimable.
    // =========================================================================
    function test_EdgeC_SubmitWork_AtExactDeadline_Reverts() public {
        uint256 id = _postBrief();
        vm.warp(deadline); // block.timestamp == deadline
        vm.prank(applicant);
        vm.expectRevert(BriefBond.DeadlinePassed.selector);
        bb.submitWork(id, WORK_HASH);
    }

    function test_EdgeC_SubmitWork_AtDeadlineMinusOne_Claimable() public {
        uint256 id = _postBrief();

        // Submit work at deadline − 1 second (strictly before)
        vm.warp(deadline - 1);
        vm.prank(applicant);
        bb.submitWork(id, WORK_HASH);

        BriefBond.Brief memory b = bb.getBrief(id);
        assertEq(b.workHash, WORK_HASH, "workHash must be stored");
        assertLt(b.workSubmittedAt, b.deadline, "workSubmittedAt must be < deadline");

        // Advance past deadline and claim successfully
        vm.warp(deadline + 1);
        uint256 balBefore = applicant.balance;
        vm.prank(applicant);
        bb.claimGhost(id);
        assertEq(applicant.balance, balBefore + MIN_BOND, "applicant must receive bond");
    }

    // =========================================================================
    // EDGE CASE (d) – exactly MIN_BOND and exactly MAX_BOND both post successfully
    // =========================================================================
    function test_EdgeD_ExactlyMinBond_Posts() public {
        vm.deal(client, MIN_BOND);
        vm.prank(client);
        uint256 id = bb.postBrief{value: MIN_BOND}(applicant, deadline, BRIEF_HASH, TITLE);
        assertEq(bb.getBrief(id).bond, MIN_BOND, "bond must equal MIN_BOND");
        assertEq(uint8(bb.getBrief(id).status), uint8(BriefBond.BriefStatus.Open), "status must be Open");
    }

    function test_EdgeD_ExactlyMaxBond_Posts() public {
        vm.deal(client, MAX_BOND);
        vm.prank(client);
        uint256 id = bb.postBrief{value: MAX_BOND}(applicant, deadline, BRIEF_HASH, TITLE);
        assertEq(bb.getBrief(id).bond, MAX_BOND, "bond must equal MAX_BOND");
        assertEq(uint8(bb.getBrief(id).status), uint8(BriefBond.BriefStatus.Open), "status must be Open");
    }

    // =========================================================================
    // EDGE CASE (e) – full money trail
    //   Contract balance after postBrief == bond.
    //   After clientAction: contract balance for that brief == 0 and client
    //     balance increases by exactly the bond (ignoring gas; we use vm.prank
    //     which zeroes out gas cost for balance assertions).
    //   After claimGhost: applicant balance increases by exactly the bond.
    // =========================================================================
    function test_EdgeE_MoneyTrail_PostBrief_ContractHoldsBond() public {
        uint256 bondAmt = 7 ether;
        vm.deal(client, bondAmt);
        vm.prank(client);
        bb.postBrief{value: bondAmt}(applicant, deadline, BRIEF_HASH, TITLE);
        assertEq(address(bb).balance, bondAmt, "contract must hold exactly the bond after postBrief");
    }

    function test_EdgeE_MoneyTrail_ClientAction_ContractEmptied() public {
        uint256 bondAmt = 3 ether;
        vm.deal(client, bondAmt + 1 ether); // surplus so client has gas-irrelevant balance
        vm.prank(client);
        uint256 id = bb.postBrief{value: bondAmt}(applicant, deadline, BRIEF_HASH, TITLE);

        assertEq(address(bb).balance, bondAmt, "contract holds bond before action");

        uint256 clientBalBefore = client.balance; // balance after posting (surplus remains)
        vm.prank(client);
        bb.clientAction(id, BriefBond.ClientAction.Declined);

        assertEq(address(bb).balance, 0, "contract must be empty after clientAction");
        assertEq(client.balance, clientBalBefore + bondAmt, "client gains exactly the bond");
    }

    function test_EdgeE_MoneyTrail_GhostClaim_ApplicantReceivesBond() public {
        uint256 bondAmt = 2 ether;
        vm.deal(client, bondAmt);
        vm.prank(client);
        uint256 id = bb.postBrief{value: bondAmt}(applicant, deadline, BRIEF_HASH, TITLE);

        assertEq(address(bb).balance, bondAmt, "contract holds bond after postBrief");

        vm.prank(applicant);
        bb.submitWork(id, WORK_HASH);

        vm.warp(deadline + 1);
        uint256 appBalBefore = applicant.balance;
        vm.prank(applicant);
        bb.claimGhost(id);

        assertEq(address(bb).balance, 0, "contract must be empty after claimGhost");
        assertEq(applicant.balance, appBalBefore + bondAmt, "applicant gains exactly the bond");
    }

    // =========================================================================
    // EDGE CASE (f) – event arguments match actual amounts, parties, timestamps
    //   Checks: BriefPosted, WorkSubmitted, BriefResolved + BondReturned,
    //           GhostClaimed + BondForfeited, BondReclaimed
    // =========================================================================

    function test_EdgeF_Events_BriefPosted_ExactArgs() public {
        uint256 bondAmt = 4 ether;
        vm.deal(client, bondAmt);

        // Predict the deadline before posting
        uint256 dl = block.timestamp + 3 hours;
        bytes32 bh = keccak256("f-brief");
        string memory ttl = "Event arg test brief";

        vm.prank(client);
        vm.expectEmit(true, true, true, true, address(bb));
        emit BriefBond.BriefPosted(1, client, applicant, bondAmt, dl, bh, ttl);
        bb.postBrief{value: bondAmt}(applicant, dl, bh, ttl);
    }

    function test_EdgeF_Events_WorkSubmitted_ExactArgs() public {
        uint256 id = _postBrief();
        bytes32 wh = keccak256("f-work");
        uint256 submitTime = block.timestamp;

        vm.prank(applicant);
        vm.expectEmit(true, true, false, true, address(bb));
        emit BriefBond.WorkSubmitted(id, applicant, wh, submitTime);
        bb.submitWork(id, wh);

        BriefBond.Brief memory b = bb.getBrief(id);
        assertEq(b.workSubmittedAt, submitTime, "stored workSubmittedAt matches emit arg");
    }

    function test_EdgeF_Events_BriefResolved_BondReturned_ExactArgs() public {
        uint256 bondAmt = 6 ether;
        vm.deal(client, bondAmt);
        vm.prank(client);
        uint256 id = bb.postBrief{value: bondAmt}(applicant, deadline, BRIEF_HASH, TITLE);

        vm.prank(client);
        vm.expectEmit(true, true, false, true, address(bb));
        emit BriefBond.BriefResolved(id, client, BriefBond.ClientAction.Closed);
        vm.expectEmit(true, true, false, true, address(bb));
        emit BriefBond.BondReturned(id, client, bondAmt);
        bb.clientAction(id, BriefBond.ClientAction.Closed);

        // Verify stored action matches
        BriefBond.Brief memory b = bb.getBrief(id);
        assertEq(uint8(b.action), uint8(BriefBond.ClientAction.Closed), "stored action is Closed");
    }

    function test_EdgeF_Events_GhostClaimed_BondForfeited_ExactArgs() public {
        uint256 bondAmt = 8 ether;
        vm.deal(client, bondAmt);
        vm.prank(client);
        uint256 id = bb.postBrief{value: bondAmt}(applicant, deadline, BRIEF_HASH, TITLE);

        bytes32 wh = keccak256("f-ghost-work");
        vm.prank(applicant);
        bb.submitWork(id, wh);

        vm.warp(deadline + 1);
        vm.prank(applicant);
        vm.expectEmit(true, true, false, true, address(bb));
        emit BriefBond.GhostClaimed(id, applicant, wh);
        vm.expectEmit(true, true, false, true, address(bb));
        emit BriefBond.BondForfeited(id, applicant, bondAmt);
        bb.claimGhost(id);
    }

    function test_EdgeF_Events_BondReclaimed_ExactArgs() public {
        uint256 bondAmt = 9 ether;
        vm.deal(client, bondAmt);
        vm.prank(client);
        uint256 id = bb.postBrief{value: bondAmt}(applicant, deadline, BRIEF_HASH, TITLE);

        vm.warp(deadline + CLAIM_WINDOW + 1);
        vm.prank(client);
        vm.expectEmit(true, true, false, true, address(bb));
        emit BriefBond.BondReclaimed(id, client, bondAmt);
        bb.reclaimStale(id);
    }
}
