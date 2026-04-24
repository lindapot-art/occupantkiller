#!/usr/bin/env node
/**
 * deploy-all.js — deploys OKC_Token + OccupantVeteranNFT + OccupantWeaponsNFT
 *                 + OccupantMarket on Polygon (mainnet or Amoy testnet)
 *
 * Usage:  node scripts/deploy/deploy-all.js amoy
 *         node scripts/deploy/deploy-all.js polygon
 *
 * Required env (contracts/.env):
 *   AMOY_RPC_URL            e.g. https://rpc-amoy.polygon.technology
 *   POLYGON_RPC_URL         e.g. https://polygon-rpc.com
 *   DEPLOYER_PRIVATE_KEY    0x-prefixed funded deployer
 *   ORACLE_PRIVATE_KEY      0x-prefixed oracle signer (backend)
 *   TREASURY_ADDRESS        multisig for treasury allocation + market fees
 *   TEAM_ADDRESS            team wallet (off-chain vesting assumed)
 *   LIQUIDITY_ADDRESS       DEX bootstrap wallet
 *   COMMUNITY_ADDRESS       community/airdrop wallet
 *   NFT_BASE_URI            e.g. https://api.occupantkiller.game/nft/
 *   WEAPONS_BASE_URI        e.g. https://api.occupantkiller.game/weapons/
 */

const fs   = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const { ethers } = require('ethers');

const NETWORKS = {
  amoy:    { rpcEnv: 'AMOY_RPC_URL',    chainId: 80002, explorer: 'https://amoy.polygonscan.com' },
  polygon: { rpcEnv: 'POLYGON_RPC_URL', chainId: 137,   explorer: 'https://polygonscan.com' },
};

function loadArtifact(name) {
  const p = path.resolve(__dirname, '..', '..', 'build', `${name}.json`);
  if (!fs.existsSync(p)) throw new Error(`Missing artifact ${name}. Run "npm run compile" first.`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function deployContract(name, wallet, args, gasHint) {
  const artifact = loadArtifact(name);
  console.log(`\n[deploy] ${name} …`);
  console.log(`[deploy]   args: ${JSON.stringify(args)}`);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(...args, gasHint || {});
  const tx = contract.deploymentTransaction();
  console.log(`[deploy]   tx:   ${tx.hash}`);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`[deploy]   → ${addr}`);
  return { address: addr, txHash: tx.hash, abi: artifact.abi };
}

async function main() {
  const netKey = (process.argv[2] || 'amoy').toLowerCase();
  const net    = NETWORKS[netKey];
  if (!net) { console.error('Unknown network:', netKey); process.exit(1); }

  const rpcUrl = process.env[net.rpcEnv];
  const pk     = process.env.DEPLOYER_PRIVATE_KEY;
  const oraclePk = process.env.ORACLE_PRIVATE_KEY;
  if (!rpcUrl || !pk || !oraclePk) {
    console.error('Missing env. Required:', net.rpcEnv, 'DEPLOYER_PRIVATE_KEY', 'ORACLE_PRIVATE_KEY');
    process.exit(1);
  }

  const treasury  = process.env.TREASURY_ADDRESS;
  const team      = process.env.TEAM_ADDRESS;
  const liquidity = process.env.LIQUIDITY_ADDRESS;
  const community = process.env.COMMUNITY_ADDRESS;
  const nftBase   = process.env.NFT_BASE_URI     || 'https://occupantkiller.example/nft/';
  const wepBase   = process.env.WEAPONS_BASE_URI || 'https://occupantkiller.example/weapons/';
  for (const [k, v] of Object.entries({ TREASURY_ADDRESS: treasury, TEAM_ADDRESS: team, LIQUIDITY_ADDRESS: liquidity, COMMUNITY_ADDRESS: community })) {
    if (!v || !ethers.isAddress(v)) { console.error(`Missing/invalid env: ${k}`); process.exit(1); }
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(pk, provider);
  const oracle   = new ethers.Wallet(oraclePk);
  const balance  = await provider.getBalance(deployer.address);

  console.log('══════════════════════════════════════════════');
  console.log(' Occupant Killer — contract deployment');
  console.log('══════════════════════════════════════════════');
  console.log(` Network:   ${netKey}  (chainId ${net.chainId})`);
  console.log(` Deployer:  ${deployer.address}`);
  console.log(` Oracle:    ${oracle.address}`);
  console.log(` Balance:   ${ethers.formatEther(balance)} POL`);
  if (balance === 0n) { console.error('Deployer has zero balance. Fund the wallet first.'); process.exit(1); }

  // Rewards pool holder == address of the deployed token itself. Since we can
  // only reference the final address AFTER deployment, strategy: deploy with
  // deployer as the rewards pool holder, then transfer 40% to the token's
  // own address post-deploy (so `claim` can transfer from address(this)).
  const okc = await deployContract('OKC_Token', deployer, [
    deployer.address,   // rewardsPoolHolder (temp — transfers to contract itself below)
    treasury,
    team,
    liquidity,
    community,
    oracle.address
  ]);
  const vet = await deployContract('OccupantVeteranNFT', deployer, [oracle.address, nftBase]);
  const wep = await deployContract('OccupantWeaponsNFT', deployer, [oracle.address, wepBase]);
  const mkt = await deployContract('OccupantMarket',     deployer, [treasury]);

  // ── Move 40% OKC from deployer to token contract itself (rewards pool) ───
  const okcContract = new ethers.Contract(okc.address, okc.abi, deployer);
  const rewardsAllocation = (10n ** 9n) * (10n ** 18n) * 40n / 100n; // 400M * 1e18
  console.log('\n[post] funding rewards pool (token self-balance)…');
  const fundTx = await okcContract.transfer(okc.address, rewardsAllocation);
  console.log(`[post]   tx: ${fundTx.hash}`);
  await fundTx.wait();
  console.log('[post]   rewards pool funded: 400,000,000 OKC on contract');

  // ── Save deployment record ───────────────────────────────────────────────
  const deploymentsDir = path.resolve(__dirname, '..', '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });
  const record = {
    network:  netKey,
    chainId:  net.chainId,
    deployer: deployer.address,
    oracle:   oracle.address,
    timestamp: new Date().toISOString(),
    contracts: {
      OKC_Token:           okc.address,
      OccupantVeteranNFT:  vet.address,
      OccupantWeaponsNFT:  wep.address,
      OccupantMarket:      mkt.address,
    },
    config: { treasury, team, liquidity, community, nftBaseURI: nftBase, weaponsBaseURI: wepBase },
    explorer: {
      OKC_Token:          `${net.explorer}/address/${okc.address}`,
      OccupantVeteranNFT: `${net.explorer}/address/${vet.address}`,
      OccupantWeaponsNFT: `${net.explorer}/address/${wep.address}`,
      OccupantMarket:     `${net.explorer}/address/${mkt.address}`,
    }
  };
  const outFile = path.join(deploymentsDir, `${netKey}.json`);
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2));
  console.log(`\n[deploy] Saved → ${path.relative(path.resolve(__dirname,'..','..','..'), outFile)}`);
  console.log('\n══════════════════════════════════════════════');
  console.log(' DEPLOYMENT COMPLETE');
  console.log('══════════════════════════════════════════════');
  for (const [k, v] of Object.entries(record.contracts)) console.log(`  ${k.padEnd(22)} ${v}`);
  console.log('\nNext: update backend/.env with these addresses, then start backend.');
}

main().catch(e => { console.error(e); process.exit(1); });
