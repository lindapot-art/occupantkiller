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
  };
})();
