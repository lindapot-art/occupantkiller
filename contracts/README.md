# Occupant Killer — Smart Contracts

Production-ready Solidity contracts for the play-to-earn layer of OccupantKiller.
Deployed on **Polygon PoS** (mainnet) and **Polygon Amoy** (testnet).

## Contracts

| File | Standard | Purpose |
|------|----------|---------|
| `OKC_Token.sol` | ERC-20 | In-game currency (1B supply, oracle-signed claim) |
| `OccupantVeteranNFT.sol` | ERC-721 (soulbound) | Achievement NFTs with 5 tiers granting earn multipliers |
| `OccupantWeaponsNFT.sol` | ERC-1155 | Tradeable weapon unlocks, skins, attachments, passes |
| `OccupantMarket.sol` | EIP-712 P2P | Seller-signed orders, 3% fee (2.5% treasury + 0.5% Ukraine) |

**Ukraine humanitarian wallet (hardcoded, immutable):** `0x165CD37b4C644C2921454429E7F9358d18A45e14`
Receives 5% of OKC supply at deploy + 0.5% of every marketplace trade.

## Tokenomics (OKC)

| Allocation | % | Use |
|-----------|---|-----|
| Player rewards | 40% | Held by the token contract itself; `claim(amount, nonce, v, r, s)` pulls from it |
| Treasury | 20% | Multisig-controlled ecosystem fund |
| Team | 15% | Off-chain 4-year vesting + 1-year cliff |
| Liquidity | 10% | DEX bootstrap (QuickSwap recommended) |
| Community | 10% | Events, airdrops, tournaments |
| Ukraine humanitarian | 5% | Verified donation wallet |

## Usage

```pwsh
cd contracts
Copy-Item .env.example .env      # then edit .env
npm install
npm run compile                  # → contracts/build/*.json
npm run deploy:amoy              # → contracts/deployments/amoy.json
```

## Security notes

- Every claim/mint uses EIP-191 signed messages with a `bytes32` nonce tracked in a replay-prevention map.
- `Ownable2Step` pattern (`transferOwnership` + `acceptOwnership`) to prevent accidental lockout.
- Market uses strict EIP-712 with seller-signed orders; signature malleability blocked via low-`s` check.
- Max claim per call = 100k OKC (adjustable via `setMaxClaimPerCall`) to cap oracle-key compromise damage.
- `paused` switch on token + weapons + market for incident response.
- NO upgradeable proxies — contracts are immutable once deployed (except owner-controlled parameters).
