#!/usr/bin/env node
/**
 * compile.js — standalone Solidity compiler (no Hardhat)
 *
 * Compiles every .sol file in contracts/ and writes artifacts to
 * contracts/build/<ContractName>.json with shape:
 *   { abi: [...], bytecode: "0x..." }
 *
 * Usage: node scripts/deploy/compile.js
 */

const fs   = require('fs');
const path = require('path');
const solc = require('solc');

const CONTRACTS_ROOT = path.resolve(__dirname, '..', '..'); // contracts/
const SRC_DIR        = CONTRACTS_ROOT;                      // .sol files live here
const BUILD_DIR      = path.join(CONTRACTS_ROOT, 'build');

function readContracts() {
  const out = {};
  for (const file of fs.readdirSync(SRC_DIR)) {
    if (file.endsWith('.sol')) {
      out[file] = { content: fs.readFileSync(path.join(SRC_DIR, file), 'utf8') };
    }
  }
  return out;
}

function main() {
  if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true });

  const sources = readContracts();
  const names   = Object.keys(sources);
  if (names.length === 0) {
    console.error('[compile] No .sol files found in', SRC_DIR);
    process.exit(1);
  }
  console.log(`[compile] Compiling ${names.length} contracts:`, names.join(', '));

  const input = {
    language: 'Solidity',
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: 'paris',
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'metadata'] }
      }
    }
  };

  const result = JSON.parse(solc.compile(JSON.stringify(input)));

  if (result.errors) {
    let fatal = false;
    for (const e of result.errors) {
      const msg = `[${e.severity.toUpperCase()}] ${e.formattedMessage || e.message}`;
      if (e.severity === 'error') { fatal = true; console.error(msg); }
      else console.warn(msg);
    }
    if (fatal) { console.error('[compile] FAILED with errors.'); process.exit(1); }
  }

  let count = 0;
  for (const file of Object.keys(result.contracts || {})) {
    for (const name of Object.keys(result.contracts[file])) {
      const c = result.contracts[file][name];
      const artifact = {
        contractName: name,
        sourceFile: file,
        abi: c.abi,
        bytecode: '0x' + c.evm.bytecode.object,
        deployedBytecode: '0x' + c.evm.deployedBytecode.object,
      };
      const out = path.join(BUILD_DIR, `${name}.json`);
      fs.writeFileSync(out, JSON.stringify(artifact, null, 2));
      console.log(`[compile] OK → ${path.relative(CONTRACTS_ROOT, out)}  (${Math.floor(c.evm.bytecode.object.length/2)} bytes)`);
      count++;
    }
  }
  console.log(`[compile] Done. ${count} artifacts written to ${BUILD_DIR}`);
}

main();
