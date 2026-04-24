// ── Occupant Killer — Oracle signing helper ──
// Signs EIP-191 "Ethereum Signed Message" payloads matching the on-chain
// `claim`/`mintTier`/`claimMint` verifiers. Uses ORACLE_PRIVATE_KEY from env.

const { ethers } = require('ethers');

let _wallet = null;
function oracleWallet() {
  if (_wallet) return _wallet;
  const pk = process.env.ORACLE_PRIVATE_KEY;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new Error('ORACLE_PRIVATE_KEY missing or invalid (need 0x + 64 hex chars)');
  }
  _wallet = new ethers.Wallet(pk);
  return _wallet;
}

// OKC_Token.claim(amount, nonce, v, r, s)
// Hash: keccak256("\x19Ethereum Signed Message:\n84" + addr + amount + nonce)
async function signOkcClaim(playerAddr, amountWei, nonceHex) {
  const w = oracleWallet();
  const payload = ethers.solidityPacked(
    ['address', 'uint256', 'bytes32'],
    [playerAddr, amountWei, nonceHex]
  );
  // signMessage prefixes with "\x19Ethereum Signed Message:\n" + payload.length
  const sig = await w.signMessage(ethers.getBytes(payload));
  const { r, s, v } = ethers.Signature.from(sig);
  return { r, s, v, nonce: nonceHex, amountWei: amountWei.toString() };
}

// OccupantVeteranNFT.mintTier(tierId, kills, nonce, v, r, s)
// Hash: keccak256("\x19Ethereum Signed Message:\n85" + addr + tierId(1) + kills(32) + nonce(32))
async function signVeteranMint(playerAddr, tierId, kills, nonceHex) {
  const w = oracleWallet();
  const payload = ethers.solidityPacked(
    ['address', 'uint8', 'uint256', 'bytes32'],
    [playerAddr, tierId, kills, nonceHex]
  );
  const sig = await w.signMessage(ethers.getBytes(payload));
  const { r, s, v } = ethers.Signature.from(sig);
  return { r, s, v, nonce: nonceHex, tierId, kills: kills.toString() };
}

// OccupantWeaponsNFT.claimMint(id, amount, nonce, v, r, s)
// Hash: keccak256("\x19Ethereum Signed Message:\n116" + addr + id(32) + amount(32) + nonce(32))
async function signWeaponMint(playerAddr, tokenId, amount, nonceHex) {
  const w = oracleWallet();
  const payload = ethers.solidityPacked(
    ['address', 'uint256', 'uint256', 'bytes32'],
    [playerAddr, tokenId, amount, nonceHex]
  );
  const sig = await w.signMessage(ethers.getBytes(payload));
  const { r, s, v } = ethers.Signature.from(sig);
  return { r, s, v, nonce: nonceHex, tokenId: tokenId.toString(), amount };
}

// Verify that a wallet signed a plain message (used for link-wallet)
function verifyPersonalSig(message, signature) {
  try { return ethers.verifyMessage(message, signature); }
  catch { return null; }
}

module.exports = {
  oracleAddress: () => oracleWallet().address,
  signOkcClaim, signVeteranMint, signWeaponMint,
  verifyPersonalSig,
};
