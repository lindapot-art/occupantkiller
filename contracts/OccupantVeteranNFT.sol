// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  Occupant Veteran NFT — Soulbound Achievement NFTs
 * @notice Non-transferable ERC-721 tokens tied to kill milestones. Each tier
 *         grants an on-chain OKC earn multiplier, applied off-chain by the
 *         backend oracle when computing claim amounts.
 *
 * Tiers:
 *   TIER 1 — Recruit    (50 kills)    → 1.05x  (tokenId 1–99999)
 *   TIER 2 — Soldier    (250 kills)   → 1.10x  (tokenId 100000–199999)
 *   TIER 3 — Hardened   (500 kills)   → 1.25x  (tokenId 200000–299999)
 *   TIER 4 — Elite      (1500 kills)  → 1.50x  (tokenId 300000–399999)
 *   TIER 5 — Liberator  (5000 kills)  → 2.00x  (tokenId 400000–499999)
 *
 * Soulbound: transfer/approve functions revert — achievement bound to wallet.
 */

contract OccupantVeteranNFT {
    // ── Metadata ─────────────────────────────────────────────────────────────
    string public constant name   = "Occupant Veteran";
    string public constant symbol = "OKVET";

    struct Tier {
        uint8   id;
        string  name;
        uint256 killsRequired;
        uint16  multiplierBps; // 10000 = 1x
        uint256 startId;
    }

    uint8 public constant TIER_COUNT = 5;
    Tier[5] public tiers;

    // ── State ────────────────────────────────────────────────────────────────
    mapping(uint256 => address) private _owners;
    mapping(address => uint256[]) private _ownedTokens;
    mapping(address => mapping(uint8 => bool)) public hasTier;
    mapping(uint256 => string) public achievementURI;
    mapping(bytes32 => bool)   private _usedNonces;

    uint256 public totalMinted;

    address public owner;
    address public pendingOwner;
    address public claimOracle;
    string  private _baseURI;

    // ── Events ───────────────────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event VeteranMinted(address indexed player, uint8 tier, uint256 tokenId, uint256 kills);
    event OracleUpdated(address indexed newOracle);
    event OwnershipTransferStarted(address indexed prev, address indexed next);
    event OwnershipTransferred(address indexed prev, address indexed next);

    modifier onlyOwner() { require(msg.sender == owner, "OKVET: not owner"); _; }

    constructor(address oracle_, string memory baseURI_) {
        require(oracle_ != address(0), "OKVET: zero oracle");
        owner       = msg.sender;
        claimOracle = oracle_;
        _baseURI    = baseURI_;

        tiers[0] = Tier(1, "Recruit",   50,   10500, 1);
        tiers[1] = Tier(2, "Soldier",   250,  11000, 100_000);
        tiers[2] = Tier(3, "Hardened",  500,  12500, 200_000);
        tiers[3] = Tier(4, "Elite",     1500, 15000, 300_000);
        tiers[4] = Tier(5, "Liberator", 5000, 20000, 400_000);
    }

    // ── Mint (oracle-signed) ─────────────────────────────────────────────────
    /**
     * @notice Oracle signs: "\x19Ethereum Signed Message:\n85" + addr + tier + kills + nonce
     *         (20 + 1 + 32 + 32 = 85 bytes).
     */
    function mintTier(
        uint8   tierId,
        uint256 kills,
        bytes32 nonce,
        uint8   v,
        bytes32 r,
        bytes32 s
    ) external {
        require(tierId >= 1 && tierId <= TIER_COUNT, "OKVET: bad tier");
        require(!hasTier[msg.sender][tierId],         "OKVET: already minted");
        require(!_usedNonces[nonce],                  "OKVET: nonce used");

        Tier storage t = tiers[tierId - 1];
        require(kills >= t.killsRequired, "OKVET: insufficient kills");

        bytes32 msgHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n85",
                msg.sender,
                tierId,
                kills,
                nonce
            )
        );
        require(ecrecover(msgHash, v, r, s) == claimOracle, "OKVET: bad sig");

        _usedNonces[nonce]          = true;
        hasTier[msg.sender][tierId] = true;

        uint256 tokenId = t.startId + (totalMinted % 99999);
        while (_owners[tokenId] != address(0)) { unchecked { tokenId++; } }

        _owners[tokenId] = msg.sender;
        _ownedTokens[msg.sender].push(tokenId);
        totalMinted++;

        achievementURI[tokenId] = string(
            abi.encodePacked(_baseURI, _toString(uint256(tierId)), "/", _toString(tokenId))
        );

        emit Transfer(address(0), msg.sender, tokenId);
        emit VeteranMinted(msg.sender, tierId, tokenId, kills);
    }

    // ── Multiplier ───────────────────────────────────────────────────────────
    function getMultiplierBps(address wallet) external view returns (uint16 best) {
        best = 10000;
        for (uint8 i = 1; i <= TIER_COUNT; i++) {
            if (hasTier[wallet][i] && tiers[i-1].multiplierBps > best) {
                best = tiers[i-1].multiplierBps;
            }
        }
    }
    function tokensOf(address wallet) external view returns (uint256[] memory) {
        return _ownedTokens[wallet];
    }
    function tierBitmask(address wallet) external view returns (uint8 mask) {
        for (uint8 i = 1; i <= TIER_COUNT; i++) {
            if (hasTier[wallet][i]) mask |= uint8(1 << (i - 1));
        }
    }

    // ── ERC-721 views ────────────────────────────────────────────────────────
    function ownerOf(uint256 tokenId) external view returns (address) {
        require(_owners[tokenId] != address(0), "OKVET: not minted");
        return _owners[tokenId];
    }
    function balanceOf(address wallet) external view returns (uint256) {
        return _ownedTokens[wallet].length;
    }
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        return achievementURI[tokenId];
    }

    // ── Soulbound guards ─────────────────────────────────────────────────────
    function transferFrom(address, address, uint256) external pure { revert("OKVET: soulbound"); }
    function safeTransferFrom(address, address, uint256) external pure { revert("OKVET: soulbound"); }
    function safeTransferFrom(address, address, uint256, bytes calldata) external pure { revert("OKVET: soulbound"); }
    function approve(address, uint256) external pure { revert("OKVET: soulbound"); }
    function setApprovalForAll(address, bool) external pure { revert("OKVET: soulbound"); }

    // ── ERC-165 ──────────────────────────────────────────────────────────────
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x80ac58cd || id == 0x5b5e139f || id == 0x01ffc9a7;
    }

    // ── Admin ────────────────────────────────────────────────────────────────
    function setOracle(address o) external onlyOwner {
        require(o != address(0), "OKVET: zero");
        claimOracle = o;
        emit OracleUpdated(o);
    }
    function setBaseURI(string calldata u) external onlyOwner { _baseURI = u; }
    function transferOwnership(address n) external onlyOwner {
        require(n != address(0), "OKVET: zero");
        pendingOwner = n;
        emit OwnershipTransferStarted(owner, n);
    }
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "OKVET: not pending");
        address prev = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(prev, owner);
    }

    // ── Internal ─────────────────────────────────────────────────────────────
    function _toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 t = v; uint256 len;
        while (t != 0) { len++; t /= 10; }
        bytes memory b = new bytes(len);
        while (v != 0) { b[--len] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(b);
    }
}
