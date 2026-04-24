/* ───────────────────────────────────────────────────────────────────────
   BLOCKCHAIN MODULE — MetaMask / Polygon Network wallet connectivity
   ─────────────────────────────────────────────────────────────────────── */
const Blockchain = (function () {
  'use strict';

  /* ── Polygon Network Config ─────────────────────────────────────── */
  const POLYGON_CHAIN_ID   = '0x89';          // 137 decimal
  const POLYGON_RPC        = 'https://polygon-rpc.com';
  const POLYGON_EXPLORER   = 'https://polygonscan.com';
  const POLYGON_CHAIN_NAME = 'Polygon Mainnet';
  const POL_SYMBOL         = 'POL';
  const POL_DECIMALS       = 18;

  /* ── Ukraine Army Donation Wallet (official crypto fund) ──────── */
  const UKRAINE_WALLET = '0x165CD37b4C644C2921454429E7F9358d18A45e14';

  /* ── Donation percentage from all game proceeds ───────────────── */
  const DONATION_PERCENT = 10;  // 10% of all POL proceeds

  /* ── State ──────────────────────────────────────────────────────── */
  let _connected   = false;
  let _account     = null;
  let _balance     = '0';       // POL balance in wei
  let _balanceStr  = '0.00';    // human readable
  let _chainId     = null;
  let _provider    = null;      // window.ethereum reference
  let _listeners   = [];        // event callbacks

  /* ── Helpers ────────────────────────────────────────────────────── */
  function weiToEth(wei) {
    if (!wei || wei === '0') return '0.00';
    var str = wei.toString();
    while (str.length <= 18) str = '0' + str;
    var intPart  = str.slice(0, str.length - 18) || '0';
    var fracPart = str.slice(str.length - 18, str.length - 14);
    return intPart + '.' + fracPart;
  }

  function ethToWei(eth) {
    var parts = eth.toString().split('.');
    var whole = parts[0] || '0';
    var frac  = (parts[1] || '').padEnd(18, '0').slice(0, 18);
    var result = whole + frac;
    /* strip leading zeros */
    result = result.replace(/^0+/, '') || '0';
    return '0x' + BigInt(result).toString(16);
  }

  function shortAddr(addr) {
    if (!addr) return '—';
    return addr.slice(0, 6) + '…' + addr.slice(-4);
  }

  function emit(event, data) {
    _listeners.forEach(function (cb) { cb(event, data); });
  }

  /* ── Network Check / Switch ────────────────────────────────────── */
  function isPolygon() { return _chainId === POLYGON_CHAIN_ID; }

  async function switchToPolygon() {
    if (!_provider) return false;
    try {
      await _provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: POLYGON_CHAIN_ID }],
      });
      return true;
    } catch (switchErr) {
      /* Chain not added — add it */
      if (switchErr.code === 4902) {
        try {
          await _provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId:        POLYGON_CHAIN_ID,
              chainName:      POLYGON_CHAIN_NAME,
              nativeCurrency: { name: 'POL', symbol: POL_SYMBOL, decimals: POL_DECIMALS },
              rpcUrls:        [POLYGON_RPC],
              blockExplorerUrls: [POLYGON_EXPLORER],
            }],
          });
          return true;
        } catch (_) { return false; }
      }
      return false;
    }
  }

  /* ── Balance ───────────────────────────────────────────────────── */
  async function fetchBalance() {
    if (!_provider || !_account) return;
    try {
      _balance = await _provider.request({
        method: 'eth_getBalance',
        params: [_account, 'latest'],
      });
      _balanceStr = weiToEth(parseInt(_balance, 16).toString());
      emit('balanceUpdate', _balanceStr);
    } catch (_) { /* silent */ }
  }

  /* ── Connect ───────────────────────────────────────────────────── */
  async function connect() {
    if (typeof window === 'undefined' || !window.ethereum) {
      emit('error', 'MetaMask not detected. Please install MetaMask to use blockchain features.');
      return false;
    }
    _provider = window.ethereum;
    try {
      var accounts = await _provider.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        emit('error', 'No accounts found. Please unlock MetaMask.');
        return false;
      }
      _account = accounts[0];
      _chainId = await _provider.request({ method: 'eth_chainId' });

      if (!isPolygon()) {
        var switched = await switchToPolygon();
        if (!switched) {
          emit('error', 'Please switch to Polygon network in MetaMask.');
          return false;
        }
        _chainId = POLYGON_CHAIN_ID;
      }

      _connected = true;
      await fetchBalance();

      /* Listen for account/chain changes */
      _provider.on('accountsChanged', function (accs) {
        if (accs.length === 0) { disconnect(); return; }
        _account = accs[0];
        fetchBalance();
        emit('accountChanged', _account);
      });
      _provider.on('chainChanged', function (chain) {
        _chainId = chain;
        if (!isPolygon()) {
          emit('wrongNetwork', 'Please switch back to Polygon network.');
        }
        fetchBalance();
        emit('chainChanged', chain);
      });

      emit('connected', { account: _account, balance: _balanceStr });
      return true;
    } catch (err) {
      emit('error', 'Connection failed: ' + (err.message || err));
      return false;
    }
  }

  /* ── Disconnect ────────────────────────────────────────────────── */
  function disconnect() {
    _connected  = false;
    _account    = null;
    _balance    = '0';
    _balanceStr = '0.00';
    _chainId    = null;
    emit('disconnected', null);
  }

  /* ── Send POL Transaction ──────────────────────────────────────── */
  async function sendPOL(toAddress, amountPOL) {
    if (!_connected || !_account || !_provider) {
      emit('error', 'Wallet not connected.');
      return null;
    }
    if (!isPolygon()) {
      emit('error', 'Wrong network. Switch to Polygon.');
      return null;
    }
    try {
      var valueWei = ethToWei(amountPOL);
      var txHash = await _provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from:  _account,
          to:    toAddress,
          value: valueWei,
          chainId: POLYGON_CHAIN_ID,
        }],
      });
      await fetchBalance();
      emit('txSent', { hash: txHash, to: toAddress, amount: amountPOL });
      return txHash;
    } catch (err) {
      emit('txFailed', err.message || 'Transaction rejected');
      return null;
    }
  }

  /* ── Purchase with auto-donation split ─────────────────────────── */
  async function purchaseWithDonation(sellerAddress, totalPOL) {
    if (!_connected) { emit('error', 'Wallet not connected.'); return null; }
    var donationAmount = (totalPOL * DONATION_PERCENT / 100);
    var sellerAmount   = totalPOL - donationAmount;

    /* Send seller portion */
    var sellerTx = await sendPOL(sellerAddress, sellerAmount.toFixed(6));
    if (!sellerTx) return null;

    /* Send donation portion to Ukraine wallet */
    var donationTx = await sendPOL(UKRAINE_WALLET, donationAmount.toFixed(6));

    emit('purchase', {
      sellerTx:     sellerTx,
      donationTx:   donationTx,
      total:        totalPOL,
      toSeller:     sellerAmount,
      toDonation:   donationAmount,
    });
    return { sellerTx, donationTx };
  }

  /* ── Getters ───────────────────────────────────────────────────── */
  function isConnected()     { return _connected; }
  function getAccount()      { return _account; }
  function getBalance()      { return _balanceStr; }
  function getBalanceWei()   { return _balance; }
  function getShortAddr()    { return shortAddr(_account); }
  function getUkraineWallet(){ return UKRAINE_WALLET; }
  function getDonationPct()  { return DONATION_PERCENT; }

  /* ══════════════════════════════════════════════════════════════════
     CONTRACT INTERACTIONS (OKC + Veteran NFT + Weapons + Market)
     Requires ethers v6 loaded (window.ethers) + ApiClient for addresses.
     ══════════════════════════════════════════════════════════════════ */
  const OKC_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function claim(uint256 amount, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
    'function nonceUsed(bytes32) view returns (bool)',
    'function totalClaimed() view returns (uint256)',
    'event Claimed(address indexed player, uint256 amount, bytes32 nonce)',
  ];
  const VETERAN_ABI = [
    'function mintTier(uint8 tierId, uint256 kills, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
    'function getMultiplierBps(address) view returns (uint16)',
    'function balanceOf(address) view returns (uint256)',
    'function tierBitmask(address) view returns (uint8)',
    'function tokensOf(address) view returns (uint256[])',
    'event VeteranMinted(address indexed player, uint8 tier, uint256 tokenId, uint256 kills)',
  ];
  const WEAPONS_ABI = [
    'function balanceOf(address account, uint256 id) view returns (uint256)',
    'function claimMint(uint256 id, uint256 amount, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
    'function setApprovalForAll(address operator, bool approved)',
    'function isApprovedForAll(address account, address operator) view returns (bool)',
    'event ClaimMinted(address indexed player, uint256 indexed id, uint256 amount, bytes32 nonce)',
  ];

  let _deployments = null;
  let _ethersProvider = null;
  let _ethersSigner   = null;

  async function _ensureEthers() {
    if (typeof window === 'undefined' || !window.ethers) throw new Error('ethers not loaded');
    if (!window.ethereum || !_connected) throw new Error('wallet not connected');
    if (!_ethersProvider) _ethersProvider = new window.ethers.BrowserProvider(window.ethereum);
    _ethersSigner = await _ethersProvider.getSigner();
    return _ethersSigner;
  }

  async function loadDeployments() {
    if (_deployments) return _deployments;
    if (typeof window === 'undefined' || !window.ApiClient) return null;
    try { _deployments = await window.ApiClient.deployments(); } catch (_) { _deployments = null; }
    return _deployments;
  }

  function _contract(name) {
    if (!_deployments || !_deployments.deployed) throw new Error('contracts not deployed');
    const addr = _deployments.contracts && _deployments.contracts[name];
    if (!addr) throw new Error('contract address missing: ' + name);
    const abi = name === 'OKC_Token' ? OKC_ABI
              : name === 'OccupantVeteranNFT' ? VETERAN_ABI
              : name === 'OccupantWeaponsNFT' ? WEAPONS_ABI
              : null;
    if (!abi) throw new Error('no ABI for ' + name);
    return new window.ethers.Contract(addr, abi, _ethersSigner || _ethersProvider);
  }

  async function getOkcBalance() {
    await _ensureEthers(); await loadDeployments();
    const okc = _contract('OKC_Token');
    const bn = await okc.balanceOf(_account);
    return window.ethers.formatUnits(bn, 18);
  }

  async function claimOkcOnChain(claimProof) {
    // claimProof = { amountWei, nonce, v, r, s } from ApiClient.claimOkc()
    await _ensureEthers(); await loadDeployments();
    const okc = _contract('OKC_Token');
    const tx  = await okc.claim(claimProof.amountWei, claimProof.nonce, claimProof.v, claimProof.r, claimProof.s);
    emit('tx:sent', { kind: 'okc-claim', hash: tx.hash });
    const rcpt = await tx.wait();
    emit('tx:confirmed', { kind: 'okc-claim', hash: tx.hash, blockNumber: rcpt.blockNumber });
    return rcpt;
  }

  async function getMultiplierBps() {
    await _ensureEthers(); await loadDeployments();
    const vet = _contract('OccupantVeteranNFT');
    return Number(await vet.getMultiplierBps(_account));
  }

  async function getOwnedVeteranMask() {
    await _ensureEthers(); await loadDeployments();
    const vet = _contract('OccupantVeteranNFT');
    return Number(await vet.tierBitmask(_account));
  }

  async function mintVeteranOnChain(mintProof) {
    // mintProof = { tierId, kills, nonce, v, r, s } from ApiClient.mintVeteran()
    await _ensureEthers(); await loadDeployments();
    const vet = _contract('OccupantVeteranNFT');
    const tx  = await vet.mintTier(mintProof.tierId, mintProof.kills, mintProof.nonce, mintProof.v, mintProof.r, mintProof.s);
    emit('tx:sent', { kind: 'veteran-mint', tier: mintProof.tierId, hash: tx.hash });
    const rcpt = await tx.wait();
    emit('tx:confirmed', { kind: 'veteran-mint', hash: tx.hash, blockNumber: rcpt.blockNumber });
    return rcpt;
  }

  async function claimWeaponOnChain(mintProof) {
    // mintProof = { tokenId, amount, nonce, v, r, s } from ApiClient.buyCosmetic()
    await _ensureEthers(); await loadDeployments();
    const wep = _contract('OccupantWeaponsNFT');
    const tx  = await wep.claimMint(mintProof.tokenId, mintProof.amount, mintProof.nonce, mintProof.v, mintProof.r, mintProof.s);
    emit('tx:sent', { kind: 'weapon-mint', hash: tx.hash });
    const rcpt = await tx.wait();
    emit('tx:confirmed', { kind: 'weapon-mint', hash: tx.hash, blockNumber: rcpt.blockNumber });
    return rcpt;
  }

  async function getWeaponBalance(tokenId) {
    await _ensureEthers(); await loadDeployments();
    const wep = _contract('OccupantWeaponsNFT');
    return Number(await wep.balanceOf(_account, tokenId));
  }

  // Produce an EIP-191 personal_sign over the link-wallet challenge, used by
  // ApiClient.linkWallet(address, sig, ts) to prove wallet ownership.
  async function signLinkWalletChallenge() {
    if (!_connected || !_account) throw new Error('wallet not connected');
    const anonId = (window.ApiClient && window.ApiClient.getAnonId && window.ApiClient.getAnonId()) || 'unknown';
    const ts     = Date.now();
    const msg    = `OccupantKiller link-wallet: anonId=${anonId} ts=${ts}`;
    const hex    = '0x' + Array.from(new TextEncoder().encode(msg)).map(b => b.toString(16).padStart(2,'0')).join('');
    const sig    = await window.ethereum.request({ method: 'personal_sign', params: [hex, _account] });
    return { address: _account, signature: sig, timestamp: ts, message: msg };
  }



  /* ── Events ────────────────────────────────────────────────────── */
  function onEvent(callback) { _listeners.push(callback); }
  function offEvent(callback) {
    _listeners = _listeners.filter(function (cb) { return cb !== callback; });
  }

  return {
    connect,
    disconnect,
    sendPOL,
    purchaseWithDonation,
    fetchBalance,
    switchToPolygon,
    isConnected,
    getAccount,
    getBalance,
    getBalanceWei,
    getShortAddr,
    getUkraineWallet,
    getDonationPct,
    isPolygon,
    onEvent,
    offEvent,
    UKRAINE_WALLET,
    DONATION_PERCENT,
    shortAddr,
    ethToWei,
    weiToEth,
    // Contract interactions (require ethers v6 + deployed contracts)
    loadDeployments,
    getOkcBalance,
    claimOkcOnChain,
    getMultiplierBps,
    getOwnedVeteranMask,
    mintVeteranOnChain,
    claimWeaponOnChain,
    getWeaponBalance,
    signLinkWalletChallenge,
  };
})();
