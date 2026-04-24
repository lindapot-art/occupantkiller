// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  Occupant Killer Coin (OKC)
 * @notice ERC-20 play-to-earn utility token for the Occupant Killer game.
 *         Deployed on Polygon PoS (Mainnet) and Polygon Amoy (testnet).
 *
 * Tokenomics (1 billion supply):
 *   40% — Player rewards pool (held by contract, distributed via oracle-signed claim)
 *   20% — Treasury / ecosystem (multisig, 2-year timelock recommended)
 *   15% — Team & advisors (off-chain vesting, 4-year schedule + 1-year cliff)
 *   10% — Liquidity provision (DEX bootstrap — QuickSwap)
 *   10% — Community events & airdrops
 *   05% — Ukraine humanitarian fund (verified donation wallet)
 *
 * Ukraine donation wallet (verified via Ukraine Gov): 0x165CD37b4C644C2921454429E7F9358d18A45e14
 *
 * Oracle-signed claim flow:
 *   1. Player earns OKC in-game; backend tracks balance in off-chain ledger
 *   2. Player requests claim — backend oracle signs EIP-191 message
 *      (player_address || amount || nonce)
 *   3. Player calls `claim(amount, nonce, v, r, s)` — contract verifies signature,
 *      marks nonce used, transfers from rewards pool to player
 */

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function totalSupply()                              external view returns (uint256);
    function balanceOf(address account)                 external view returns (uint256);
    function transfer(address to, uint256 amount)       external returns (bool);
    function allowance(address owner, address spender)  external view returns (uint256);
    function approve(address spender, uint256 amount)   external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IERC20Metadata is IERC20 {
    function name()     external view returns (string memory);
    function symbol()   external view returns (string memory);
    function decimals() external view returns (uint8);
}

contract OKC_Token is IERC20Metadata {
    // ── Metadata ─────────────────────────────────────────────────────────────
    string public constant name     = "Occupant Killer Coin";
    string public constant symbol   = "OKC";
    uint8  public constant decimals = 18;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;

    // ── Key addresses ────────────────────────────────────────────────────────
    address public immutable UKRAINE_WALLET = 0x165CD37b4C644C2921454429E7F9358d18A45e14;
    address public owner;
    address public pendingOwner;
    address public claimOracle;
    bool    public paused;

    // ── ERC-20 state ─────────────────────────────────────────────────────────
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    // ── Claim state ──────────────────────────────────────────────────────────
    mapping(bytes32 => bool) private _usedNonces;
    uint256 public totalClaimed;
    uint256 public maxClaimPerCall = 100_000 * 1e18; // 100k OKC cap per single claim

    // ── Events ───────────────────────────────────────────────────────────────
    event Claimed(address indexed player, uint256 amount, bytes32 nonce);
    event OracleUpdated(address indexed newOracle);
    event OwnershipTransferStarted(address indexed prev, address indexed next);
    event OwnershipTransferred(address indexed prev, address indexed next);
    event PausedState(bool paused);
    event MaxClaimUpdated(uint256 newMax);

    modifier onlyOwner()  { require(msg.sender == owner, "OKC: not owner"); _; }
    modifier whenNotPaused() { require(!paused, "OKC: paused"); _; }

    // ── Constructor ──────────────────────────────────────────────────────────
    /**
     * @param rewardsPoolHolder  receives 40% (recommended: this contract itself via address(0xBEEF) trick — see deploy script).
     *                           In practice the deploy script sends the 40% back to the contract address.
     * @param treasury  multisig
     * @param team      team wallet (off-chain vesting enforced)
     * @param liquidity DEX bootstrap wallet
     * @param community community/airdrop wallet
     * @param oracle_   initial claim oracle signer
     */
    constructor(
        address rewardsPoolHolder,
        address treasury,
        address team,
        address liquidity,
        address community,
        address oracle_
    ) {
        require(rewardsPoolHolder != address(0) && treasury != address(0)
            && team != address(0) && liquidity != address(0)
            && community != address(0) && oracle_ != address(0),
            "OKC: zero address");
        owner       = msg.sender;
        claimOracle = oracle_;

        uint256 s = TOTAL_SUPPLY;
        _mint(rewardsPoolHolder, s * 40 / 100);
        _mint(treasury,          s * 20 / 100);
        _mint(team,              s * 15 / 100);
        _mint(liquidity,         s * 10 / 100);
        _mint(community,         s * 10 / 100);
        _mint(UKRAINE_WALLET,    s *  5 / 100);
    }

    // ── ERC-20 core ──────────────────────────────────────────────────────────
    function totalSupply() external view returns (uint256) { return _totalSupply; }
    function balanceOf(address a) external view returns (uint256) { return _balances[a]; }

    function transfer(address to, uint256 amount) external whenNotPaused returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }
    function allowance(address o, address s_) external view returns (uint256) {
        return _allowances[o][s_];
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    function transferFrom(address from, address to, uint256 amount)
        external whenNotPaused returns (bool)
    {
        uint256 allowed = _allowances[from][msg.sender];
        require(allowed >= amount, "OKC: allowance exceeded");
        unchecked { _allowances[from][msg.sender] = allowed - amount; }
        _transfer(from, to, amount);
        return true;
    }

    // ── Claim (oracle-signed) ────────────────────────────────────────────────
    /**
     * @notice Claim OKC earned in-game. Oracle signs
     *         keccak256("\x19Ethereum Signed Message:\n84" || addr || amount || nonce).
     * @dev Rewards pool must hold at least `amount` tokens. Deploy script funds
     *      the contract itself (address(this)) with the 40% allocation so
     *      `_transfer(address(this), msg.sender, amount)` succeeds.
     */
    function claim(uint256 amount, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)
        external whenNotPaused
    {
        require(amount > 0 && amount <= maxClaimPerCall, "OKC: bad amount");
        require(!_usedNonces[nonce], "OKC: nonce used");

        // 20 (addr) + 32 (amount) + 32 (nonce) = 84 bytes
        bytes32 msgHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n84",
                msg.sender,
                amount,
                nonce
            )
        );
        require(ecrecover(msgHash, v, r, s) == claimOracle, "OKC: bad sig");

        _usedNonces[nonce] = true;
        totalClaimed += amount;
        _transfer(address(this), msg.sender, amount);
        emit Claimed(msg.sender, amount, nonce);
    }

    function nonceUsed(bytes32 n) external view returns (bool) { return _usedNonces[n]; }

    // ── Admin ────────────────────────────────────────────────────────────────
    function setOracle(address o) external onlyOwner {
        require(o != address(0), "OKC: zero oracle");
        claimOracle = o;
        emit OracleUpdated(o);
    }
    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PausedState(p);
    }
    function setMaxClaimPerCall(uint256 m) external onlyOwner {
        require(m > 0, "OKC: zero max");
        maxClaimPerCall = m;
        emit MaxClaimUpdated(m);
    }

    // Ownable2Step — safer transfer
    function transferOwnership(address next) external onlyOwner {
        require(next != address(0), "OKC: zero next");
        pendingOwner = next;
        emit OwnershipTransferStarted(owner, next);
    }
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "OKC: not pending");
        address prev = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(prev, owner);
    }

    // ── Internal ─────────────────────────────────────────────────────────────
    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "OKC: mint to zero");
        _totalSupply     += amount;
        _balances[to]    += amount;
        emit Transfer(address(0), to, amount);
    }
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0) && to != address(0), "OKC: zero addr");
        require(_balances[from] >= amount, "OKC: insufficient");
        unchecked {
            _balances[from] -= amount;
            _balances[to]   += amount;
        }
        emit Transfer(from, to, amount);
    }
}
