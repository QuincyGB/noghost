// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BriefBond {
    uint256 public constant MIN_BOND = 1 ether;
    uint256 public constant MAX_BOND = 1000 ether;
    uint256 public constant MIN_DURATION = 1 hours;
    uint256 public constant MAX_DURATION = 90 days;
    uint256 public constant CLAIM_WINDOW = 30 days;
    uint256 public constant MAX_TITLE_BYTES = 120;

    enum BriefStatus {
        Open,
        Resolved,
        Forfeited,
        Reclaimed
    }

    enum ClientAction {
        Hired,
        Declined,
        Closed
    }

    struct Brief {
        address client;
        address applicant;
        uint256 bond;
        uint256 deadline;
        bytes32 briefHash;
        string title;
        bytes32 workHash;
        uint256 workSubmittedAt;
        BriefStatus status;
        ClientAction action;
        bool actionRecorded;
    }

    uint256 public nextBriefId;
    mapping(uint256 => Brief) public briefs;

    error BondTooSmall();
    error BondTooLarge();
    error ZeroApplicant();
    error ApplicantIsClient();
    error DeadlineTooSoon();
    error DeadlineTooFar();
    error ZeroBriefHash();
    error TitleEmpty();
    error TitleTooLong();
    error BriefNotFound();
    error BriefNotOpen();
    error NotApplicant();
    error NotClient();
    error DeadlinePassed();
    error ZeroWorkHash();
    error DeadlineNotPassed();
    error ClaimWindowExpired();
    error NoWorkRecorded();
    error WorkSubmittedLate();
    error ClaimWindowNotExpired();

    event BriefPosted(
        uint256 indexed briefId,
        address indexed client,
        address indexed applicant,
        uint256 bond,
        uint256 deadline,
        bytes32 briefHash,
        string title
    );
    event WorkSubmitted(uint256 indexed briefId, address indexed applicant, bytes32 workHash, uint256 submittedAt);
    event BriefResolved(uint256 indexed briefId, address indexed client, ClientAction action);
    event BondReturned(uint256 indexed briefId, address indexed client, uint256 amount);
    event GhostClaimed(uint256 indexed briefId, address indexed applicant, bytes32 workHash);
    event BondForfeited(uint256 indexed briefId, address indexed applicant, uint256 amount);
    event BondReclaimed(uint256 indexed briefId, address indexed client, uint256 amount);

    constructor() {
        nextBriefId = 1;
    }

    function postBrief(address applicant, uint256 deadline, bytes32 briefHash, string calldata title)
        external
        payable
        returns (uint256 briefId)
    {
        if (msg.value < MIN_BOND) revert BondTooSmall();
        if (msg.value > MAX_BOND) revert BondTooLarge();
        if (applicant == address(0)) revert ZeroApplicant();
        if (applicant == msg.sender) revert ApplicantIsClient();
        if (deadline < block.timestamp + MIN_DURATION) revert DeadlineTooSoon();
        if (deadline > block.timestamp + MAX_DURATION) revert DeadlineTooFar();
        if (briefHash == bytes32(0)) revert ZeroBriefHash();

        uint256 titleLength = bytes(title).length;
        if (titleLength == 0) revert TitleEmpty();
        if (titleLength > MAX_TITLE_BYTES) revert TitleTooLong();

        briefId = nextBriefId++;
        briefs[briefId] = Brief({
            client: msg.sender,
            applicant: applicant,
            bond: msg.value,
            deadline: deadline,
            briefHash: briefHash,
            title: title,
            workHash: bytes32(0),
            workSubmittedAt: 0,
            status: BriefStatus.Open,
            action: ClientAction.Hired,
            actionRecorded: false
        });

        emit BriefPosted(briefId, msg.sender, applicant, msg.value, deadline, briefHash, title);
    }

    function submitWork(uint256 briefId, bytes32 workHash) external {
        Brief storage b = briefs[briefId];

        if (b.client == address(0)) revert BriefNotFound();
        if (b.status != BriefStatus.Open) revert BriefNotOpen();
        if (msg.sender != b.applicant) revert NotApplicant();
        if (block.timestamp >= b.deadline) revert DeadlinePassed();
        if (workHash == bytes32(0)) revert ZeroWorkHash();

        b.workHash = workHash;
        b.workSubmittedAt = block.timestamp;

        emit WorkSubmitted(briefId, msg.sender, workHash, block.timestamp);
    }

    function clientAction(uint256 briefId, ClientAction action) external {
        Brief storage b = briefs[briefId];

        if (b.client == address(0)) revert BriefNotFound();
        if (b.status != BriefStatus.Open) revert BriefNotOpen();
        if (msg.sender != b.client) revert NotClient();
        if (block.timestamp >= b.deadline) revert DeadlinePassed();

        uint256 amount = b.bond;
        b.status = BriefStatus.Resolved;
        b.actionRecorded = true;
        b.action = action;
        address client = b.client;

        emit BriefResolved(briefId, client, action);
        emit BondReturned(briefId, client, amount);

        (bool ok,) = client.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    function claimGhost(uint256 briefId) external {
        Brief storage b = briefs[briefId];

        if (b.client == address(0)) revert BriefNotFound();
        if (b.status != BriefStatus.Open) revert BriefNotOpen();
        if (msg.sender != b.applicant) revert NotApplicant();
        if (block.timestamp <= b.deadline) revert DeadlineNotPassed();
        if (block.timestamp > b.deadline + CLAIM_WINDOW) revert ClaimWindowExpired();
        if (b.workHash == bytes32(0)) revert NoWorkRecorded();
        if (b.workSubmittedAt >= b.deadline) revert WorkSubmittedLate();

        uint256 amount = b.bond;
        bytes32 wh = b.workHash;
        address applicant = b.applicant;
        b.status = BriefStatus.Forfeited;

        emit GhostClaimed(briefId, applicant, wh);
        emit BondForfeited(briefId, applicant, amount);

        (bool ok,) = applicant.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    function reclaimStale(uint256 briefId) external {
        Brief storage b = briefs[briefId];

        if (b.client == address(0)) revert BriefNotFound();
        if (b.status != BriefStatus.Open) revert BriefNotOpen();
        if (msg.sender != b.client) revert NotClient();
        if (block.timestamp <= b.deadline + CLAIM_WINDOW) revert ClaimWindowNotExpired();

        uint256 amount = b.bond;
        address client = b.client;
        b.status = BriefStatus.Reclaimed;

        emit BondReclaimed(briefId, client, amount);

        (bool ok,) = client.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    function getBrief(uint256 briefId) external view returns (Brief memory) {
        return briefs[briefId];
    }
}
