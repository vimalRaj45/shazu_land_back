/**
 * Shazu Soft Technologies - Full System Test Suite Runner
 * Runs Backend Integration Tests and Frontend Playwright E2E Tests sequentially.
 */
const { spawn } = require('child_process');
const path = require('path');

function runScript(scriptPath, label) {
  return new Promise((resolve) => {
    console.log(`\n>>> STARTING ${label}...`);
    const proc = spawn('node', [scriptPath], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });

    proc.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

async function main() {
  console.log('\n==================================================================');
  console.log('  SHAZU SOFT TECHNOLOGIES - UNIFIED FULL SYSTEM TEST SUITE');
  console.log('==================================================================\n');

  const backendOk = await runScript(
    path.join(__dirname, '../backend/tests/backend-test-suite.js'),
    '1. BACKEND INTEGRATION & SECURITY SUITE'
  );

  const frontendOk = await runScript(
    path.join(__dirname, 'frontend-playwright.test.js'),
    '2. FRONTEND PLAYWRIGHT E2E SUITE'
  );

  console.log('\n==================================================================');
  console.log('  FINAL SYSTEM TEST SUMMARY:');
  console.log(`  • Backend Integration & Security Tests: ${backendOk ? '\x1b[32mPASSED\x1b[0m' : '\x1b[31mFAILED\x1b[0m'}`);
  console.log(`  • Frontend Playwright E2E Tests:         ${frontendOk ? '\x1b[32mPASSED\x1b[0m' : '\x1b[31mFAILED\x1b[0m'}`);
  console.log('==================================================================\n');

  if (!backendOk || !frontendOk) {
    process.exit(1);
  } else {
    console.log('ALL SYSTEM TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  }
}

main();
