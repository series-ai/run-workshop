#!/usr/bin/env npx tsx
/**
 * CLI harness — run procedural systems outside the browser.
 *
 * Usage: npx tsx src/cli/run.ts <command> [--json]
 *
 * Pattern: write unit tests → implement → verify CLI output here →
 *          then wire into React/Three.js.
 *
 * Add a command for each procedural system worth manual inspection:
 * probability distributions, simulation ticks, proc-gen seeds, etc.
 * Output JSON so results are scriptable:
 *   npx tsx src/cli/run.ts <cmd> | jq .
 */

// Example import (add yours as systems are built):
// import { drawGacha } from '../systems/GachaSystem.js';

const [, , command, ...rest] = process.argv;
const asJson = rest.includes('--json');

function _out(data: unknown): void {
  console.log(asJson ? JSON.stringify(data, null, 2) : String(data));
}

function help(): void {
  console.log('Usage: npx tsx src/cli/run.ts <command> [--json]');
  console.log('');
  console.log('Commands:');
  console.log('  (add yours here as systems are built)');
  console.log('');
  console.log('Options:');
  console.log('  --json   output as JSON');
}

switch (command) {
  case undefined:
  case '--help':
  case '-h':
    help();
    break;

  // Add commands here as you build systems. Example:
  // case 'gacha':
  //   _out(drawGacha({ rarityWeights: [70, 20, 8, 2] }));
  //   break;

  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
