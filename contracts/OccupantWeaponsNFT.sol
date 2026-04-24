// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  Occupant Weapons NFT — ERC-1155 tradeable skins, unlocks & attachments
 * @notice Multi-token contract for game items:
 *           - Weapon unlocks (permanent grant of a weapon)
 *           - Weapon skins (cosmetic)
 *           - Attachments (stat bonuses: damage, accuracy, reload, magazine)
 *           - Premium battle passes (time-bound memberships)
 *
 *         Rarity tiers embedded in `tokenMeta[id]`:
 *           common, rare, epic, legendary, mythic — with `bonusBps` for attachments.
 *
 *         Mint is oracle-signed (same EIP-191 pattern as OKC token) so purchases
 *         flow: player pays OKC/POL on backend → backend signs mint proof →
 *         player calls `claimMint(id, amount, nonce, v, r, s)`.
 *
 *         Transfers fully allowed (tradeable on OpenSea / P2P market).
 */

interface IERC1155 {
    event TransferSingle(address indexed op, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(address indexed op, address indexed from, address indexed to, uint256[] ids, uint256[] values);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event URI(string value, uint256 indexed id);

    function balanceOf(address account, uint256 id) external view returns (uint256);
    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) external view returns (uint256[] memory);
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address account, address operator) external view returns (bool);
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
    function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data) external;
}

interface IERC1155Receiver {
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external returns (bytes4);
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external returns (bytes4);
}

contract OccupantWeaponsNFT is IERC1155 {
    // ── Metadata ─────────────────────────────────────────────────────────────
    string public constant name   = "Occupant Weapons";
    string public constant symbol = "OKWEP";

    enum ItemType { WEAPON_UNLOCK, SKIN, ATTACHMENT, BATTLE_PASS, CONSUMABLE }
    enum Rarity   { COMMON, RARE, EPIC, LEGENDARY, MYTHIC }

    struct TokenMeta {
        bool     exists;
        ItemType itemType;
        Rarity   rarity;
        uint16   bonusBps;   // 10000 = baseline, applied by game client for attachments
        string   label;      // human-readable (e.g. "Gold AK-74 Skin")
        string   weaponKey;  // e.g. "AK74" — matches in-game weapon ID
    }

    mapping(uint256 => TokenMeta) public tokenMeta;
    mapping(uint256 => mapping(address => uint256)) private _balances;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(bytes32 => bool) private _usedNonces;

    // ── Admin ────────────────────────────────────────────────────────────────
    address public owner;
    address public pendingOwner;
    address public claimOracle;
    string  private _baseURI;
    bool    public paused;

    event ItemRegistered(uint256 indexed id, uint8 itemType, uint8 rarity, uint16 bonusBps, string label, string weaponKey);
    event ClaimMinted(address indexed player, uint256 indexed id, uint256 amount, bytes32 nonce);
    event OracleUpdated(address indexed newOracle);
    event OwnershipTransferStarted(address indexed prev, address indexed next);
    event OwnershipTransferred(address indexed prev, address indexed next);

    modifier onlyOwner()     { require(msg.sender == owner, "OKWEP: not owner"); _; }
    modifier whenNotPaused() { require(!paused, "OKWEP: paused"); _; }

    constructor(address oracle_, string memory baseURI_) {
        require(oracle_ != address(0), "OKWEP: zero oracle");
        owner       = msg.sender;
        claimOracle = oracle_;
        _baseURI    = baseURI_;
    }

    // ── Item catalog management ──────────────────────────────────────────────
    function registerItem(
        uint256  id,
        ItemType itemType,
        Rarity   rarity,
        uint16   bonusBps,
        string calldata label,
        string calldata weaponKey
    ) external onlyOwner {
        require(!tokenMeta[id].exists, "OKWEP: id registered");
        tokenMeta[id] = TokenMeta(true, itemType, rarity, bonusBps, label, weaponKey);
        emit ItemRegistered(id, uint8(itemType), uint8(rarity), bonusBps, label, weaponKey);
    }

    // ── Oracle-signed claim/mint ─────────────────────────────────────────────
    /**
     * @notice Oracle signs: "\x19Ethereum Signed Message:\n116"
     *         + player (20) + id (32) + amount (32) + nonce (32) = 116 bytes
     */
    function claimMint(
        uint256 id,
        uint256 amount,
        bytes32 nonce,
        uint8   v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused {
        require(tokenMeta[id].exists, "OKWEP: unknown id");
        require(amount > 0 && amount <= 1000, "OKWEP: bad amount");
        require(!_usedNonces[nonce], "OKWEP: nonce used");

        bytes32 msgHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n116",
                msg.sender,
                id,
                amount,
                nonce
            )
        );
        require(ecrecover(msgHash, v, r, s) == claimOracle, "OKWEP: bad sig");

        _usedNonces[nonce] = true;
        _balances[id][msg.sender] += amount;

        emit TransferSingle(msg.sender, address(0), msg.sender, id, amount);
        emit ClaimMinted(msg.sender, id, amount, nonce);
    }

    // ── ERC-1155 core ────────────────────────────────────────────────────────
    function balanceOf(address account, uint256 id) public view returns (uint256) {
        return _balances[id][account];
    }
    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids)
        external view returns (uint256[] memory result)
    {
        require(accounts.length == ids.length, "OKWEP: len mismatch");
        result = new uint256[](accounts.length);
        for (uint i = 0; i < accounts.length; i++) {
            result[i] = _balances[ids[i]][accounts[i]];
        }
    }
    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    function isApprovedForAll(address account, address operator) public view returns (bool) {
        return _operatorApprovals[account][operator];
    }
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data)
        external whenNotPaused
    {
        require(to != address(0), "OKWEP: zero to");
        require(from == msg.sender || isApprovedForAll(from, msg.sender), "OKWEP: not approved");
        require(_balances[id][from] >= amount, "OKWEP: insufficient");
        unchecked { _balances[id][from] -= amount; }
        _balances[id][to] += amount;
        emit TransferSingle(msg.sender, from, to, id, amount);
        _doSafeTransferAcceptanceCheck(msg.sender, from, to, id, amount, data);
    }
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external whenNotPaused {
        require(to != address(0), "OKWEP: zero to");
        require(from == msg.sender || isApprovedForAll(from, msg.sender), "OKWEP: not approved");
        require(ids.length == amounts.length, "OKWEP: len mismatch");
        for (uint i = 0; i < ids.length; i++) {
            require(_balances[ids[i]][from] >= amounts[i], "OKWEP: insufficient");
            unchecked { _balances[ids[i]][from] -= amounts[i]; }
            _balances[ids[i]][to] += amounts[i];
        }
        emit TransferBatch(msg.sender, from, to, ids, amounts);
        _doSafeBatchTransferAcceptanceCheck(msg.sender, from, to, ids, amounts, data);
    }

    // ── Metadata URI ─────────────────────────────────────────────────────────
    function uri(uint256 id) external view returns (string memory) {
        return string(abi.encodePacked(_baseURI, _toString(id), ".json"));
    }

    // ── ERC-165 ──────────────────────────────────────────────────────────────
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0xd9b67a26   // ERC-1155
            || id == 0x0e89341c   // ERC-1155Metadata_URI
            || id == 0x01ffc9a7;  // ERC-165
    }

    // ── Admin ────────────────────────────────────────────────────────────────
    function setOracle(address o) external onlyOwner {
        require(o != address(0), "OKWEP: zero");
        claimOracle = o;
        emit OracleUpdated(o);
    }
    function setBaseURI(string calldata u) external onlyOwner { _baseURI = u; }
    function setPaused(bool p) external onlyOwner { paused = p; }
    function transferOwnership(address n) external onlyOwner {
        require(n != address(0), "OKWEP: zero");
        pendingOwner = n;
        emit OwnershipTransferStarted(owner, n);
    }
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "OKWEP: not pending");
        address prev = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(prev, owner);
    }

    // ── Internal helpers ─────────────────────────────────────────────────────
    function _doSafeTransferAcceptanceCheck(
        address operator, address from, address to, uint256 id, uint256 amount, bytes memory data
    ) internal {
        if (_isContract(to)) {
            try IERC1155Receiver(to).onERC1155Received(operator, from, id, amount, data) returns (bytes4 resp) {
                require(resp == IERC1155Receiver.onERC1155Received.selector, "OKWEP: bad receiver");
            } catch { revert("OKWEP: transfer to non-receiver"); }
        }
    }
    function _doSafeBatchTransferAcceptanceCheck(
        address operator, address from, address to, uint256[] calldata ids, uint256[] calldata amounts, bytes memory data
    ) internal {
        if (_isContract(to)) {
            try IERC1155Receiver(to).onERC1155BatchReceived(operator, from, ids, amounts, data) returns (bytes4 resp) {
                require(resp == IERC1155Receiver.onERC1155BatchReceived.selector, "OKWEP: bad receiver");
            } catch { revert("OKWEP: batch to non-receiver"); }
        }
    }
    function _isContract(address a) internal view returns (bool) {
        uint256 size; assembly { size := extcodesize(a) } return size > 0;
    }
    function _toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 t = v; uint256 len;
        while (t != 0) { len++; t /= 10; }
        bytes memory b = new bytes(len);
        while (v != 0) { b[--len] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(b);
    }
}
