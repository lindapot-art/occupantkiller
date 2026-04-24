// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  Occupant Market — P2P NFT marketplace (ERC-721 + ERC-1155)
 * @notice EIP-712 signed orders — sellers sign OFF-CHAIN, buyers submit on-chain
 *         `executeOrder(order, sig)`. Payment is in native POL. Fees:
 *           2.5% → treasury
 *           0.5% → Ukraine humanitarian wallet
 *          97.0% → seller
 *
 *         Supports both ERC-721 (`tokenContract` has transferFrom) and ERC-1155
 *         (`safeTransferFrom` with `amount > 0`). `amount == 0` is treated as
 *         ERC-721 (quantity always 1).
 */

interface IERC721Like {
    function transferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}
interface IERC1155Like {
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract OccupantMarket {
    // ── EIP-712 ──────────────────────────────────────────────────────────────
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address seller,address tokenContract,uint256 tokenId,uint256 amount,uint256 priceWei,uint256 expiresAt,bytes32 nonce,bool isERC1155)"
    );

    struct Order {
        address seller;
        address tokenContract;
        uint256 tokenId;
        uint256 amount;       // 1 for ERC-721, N for ERC-1155
        uint256 priceWei;     // total price in POL wei
        uint256 expiresAt;    // unix seconds
        bytes32 nonce;        // arbitrary, signed by seller
        bool    isERC1155;
    }

    // ── Fee config ───────────────────────────────────────────────────────────
    address public immutable UKRAINE_WALLET = 0x165CD37b4C644C2921454429E7F9358d18A45e14;
    address public treasury;
    uint16  public treasuryFeeBps = 250; // 2.5%
    uint16  public ukraineFeeBps  = 50;  // 0.5%
    uint16  public constant MAX_FEE_BPS = 1000; // max 10% total enforced

    // ── State ────────────────────────────────────────────────────────────────
    mapping(bytes32 => bool) public orderFilled; // by nonce
    mapping(bytes32 => bool) public orderCancelled;

    address public owner;
    address public pendingOwner;
    bool    public paused;

    event OrderExecuted(
        bytes32 indexed nonce,
        address indexed seller,
        address indexed buyer,
        address tokenContract,
        uint256 tokenId,
        uint256 amount,
        uint256 priceWei
    );
    event OrderCancelled(bytes32 indexed nonce, address indexed seller);
    event FeesUpdated(uint16 treasuryBps, uint16 ukraineBps);
    event TreasuryUpdated(address indexed treasury);
    event OwnershipTransferStarted(address indexed prev, address indexed next);
    event OwnershipTransferred(address indexed prev, address indexed next);

    modifier onlyOwner()     { require(msg.sender == owner, "MKT: not owner"); _; }
    modifier whenNotPaused() { require(!paused, "MKT: paused"); _; }

    constructor(address treasury_) {
        require(treasury_ != address(0), "MKT: zero treasury");
        owner    = msg.sender;
        treasury = treasury_;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("OccupantMarket")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // ── Execute ──────────────────────────────────────────────────────────────
    function executeOrder(Order calldata o, bytes calldata sig)
        external payable whenNotPaused
    {
        require(block.timestamp <= o.expiresAt, "MKT: expired");
        require(!orderFilled[o.nonce],    "MKT: filled");
        require(!orderCancelled[o.nonce], "MKT: cancelled");
        require(msg.value == o.priceWei,  "MKT: bad payment");
        require(o.seller != address(0) && o.seller != msg.sender, "MKT: bad seller");

        // EIP-712 verify
        bytes32 structHash = keccak256(
            abi.encode(
                ORDER_TYPEHASH,
                o.seller,
                o.tokenContract,
                o.tokenId,
                o.amount,
                o.priceWei,
                o.expiresAt,
                o.nonce,
                o.isERC1155
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        require(_recover(digest, sig) == o.seller, "MKT: bad sig");

        orderFilled[o.nonce] = true;

        // Transfer NFT
        if (o.isERC1155) {
            require(o.amount > 0, "MKT: zero amount");
            IERC1155Like(o.tokenContract).safeTransferFrom(o.seller, msg.sender, o.tokenId, o.amount, "");
        } else {
            require(o.amount == 1, "MKT: erc721 amount=1");
            IERC721Like(o.tokenContract).transferFrom(o.seller, msg.sender, o.tokenId);
        }

        // Split payment
        uint256 treasuryFee = (o.priceWei * treasuryFeeBps) / 10000;
        uint256 ukraineFee  = (o.priceWei * ukraineFeeBps)  / 10000;
        uint256 sellerCut   = o.priceWei - treasuryFee - ukraineFee;

        (bool t1,) = treasury.call{value: treasuryFee}("");        require(t1, "MKT: treasury xfer");
        (bool t2,) = UKRAINE_WALLET.call{value: ukraineFee}("");    require(t2, "MKT: ukraine xfer");
        (bool t3,) = o.seller.call{value: sellerCut}("");           require(t3, "MKT: seller xfer");

        emit OrderExecuted(o.nonce, o.seller, msg.sender, o.tokenContract, o.tokenId, o.amount, o.priceWei);
    }

    function cancelOrder(bytes32 nonce) external {
        orderCancelled[nonce] = true;
        emit OrderCancelled(nonce, msg.sender);
    }

    // ── Admin ────────────────────────────────────────────────────────────────
    function setFees(uint16 treasuryBps, uint16 ukraineBps) external onlyOwner {
        require(treasuryBps + ukraineBps <= MAX_FEE_BPS, "MKT: fees too high");
        treasuryFeeBps = treasuryBps;
        ukraineFeeBps  = ukraineBps;
        emit FeesUpdated(treasuryBps, ukraineBps);
    }
    function setTreasury(address t) external onlyOwner {
        require(t != address(0), "MKT: zero");
        treasury = t;
        emit TreasuryUpdated(t);
    }
    function setPaused(bool p) external onlyOwner { paused = p; }
    function transferOwnership(address n) external onlyOwner {
        require(n != address(0), "MKT: zero");
        pendingOwner = n;
        emit OwnershipTransferStarted(owner, n);
    }
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "MKT: not pending");
        address prev = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(prev, owner);
    }

    // ── Internal ─────────────────────────────────────────────────────────────
    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "MKT: sig len");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "MKT: bad v");
        // prevent signature malleability
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "MKT: bad s");
        return ecrecover(digest, v, r, s);
    }
}
