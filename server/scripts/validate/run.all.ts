#!/usr/bin/env node
/**
 * Master Validation Runner
 * Run: npx tsx scripts/validate/run.all.ts
 *
 * Runs all validation suites in sequence:
 * 1. Environment validation (startup)
 * 2. Database load tests
 * 3. Queue stress tests
 * 4. Security penetration tests
 *
 * Exits 0 = GO (safe to deploy)
 * Exits 1 = NO-GO (blockers found)
 */

import { execSync, type ExecSyncOptions } from 'child_process'
import dotenv from 'dotenv'
dotenv.config()

interface Suite {
  name:     string
  script:   string
  critical: boolean  // If true, failure blocks launch
}

const SUITES: Suite[] = [
  { name: 'Database Load Validation',      script: 'scripts/validate/db.load.ts',           critical: true  },
  { name: 'Queue Stress Validation',       script: 'scripts/validate/queue.stress.ts',      critical: true  },
  { name: 'Security Penetration Testing',  script: 'scripts/validate/security.pentest.ts',  critical: true  },
]

interface SuiteResult {
  suite:    string
  passed:   boolean
  duration: number
  error?:   string
}

const results: SuiteResult[] = []

async function runSuite(suite: Suite): Promise<SuiteResult> {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Running: ${suite.name}`)
  console.log(`${'═'.repeat(60)}`)

  const t0 = Date.now()
  const opts: ExecSyncOptions = {
    stdio: 'inherit',
    env:   { ...process.env },
  }

  try {
    execSync(`npx tsx ${suite.script}`, opts)
    const duration = Date.now() - t0
    console.log(`\n✅ ${suite.name} passed in ${(duration / 1000).toFixed(1)}s`)
    return { suite: suite.name, passed: true, duration }
  } catch (err) {
    const duration = Date.now() - t0
    const errMsg = (err as NodeJS.ErrnoException).message ?? String(err)
    console.error(`\n❌ ${suite.name} FAILED in ${(duration / 1000).toFixed(1)}s`)
    return { suite: suite.name, passed: false, duration, error: errMsg }
  }
}

async function main(): Promise<void> {
  const startTime = Date.now()

  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║   WhatsFlow AI — Final Pre-Launch Validation Runner      ║')
  console.log(`║   Started: ${new Date().toISOString()}            ║`)
  console.log('╚══════════════════════════════════════════════════════════╝')

  for (const suite of SUITES) {
    const result = await runSuite(suite)
    results.push(result)

    // Fail fast on critical suite failure
    if (!result.passed && suite.critical) {
      console.error(`\n🛑 Critical suite failed: ${suite.name}. Stopping validation.`)
      break
    }
  }

  const totalMs = Date.now() - startTime
  const allPassed = results.every((r) => r.passed)
  const failed    = results.filter((r) => !r.passed)

  // ── Final Report ───────────────────────────────────────────────────────────
  console.log('\n')
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║              FINAL VALIDATION REPORT                    ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌'
    console.log(`${icon} ${r.suite.padEnd(40)} ${(r.duration / 1000).toFixed(1)}s`)
  }

  console.log(`\nTotal time: ${(totalMs / 1000).toFixed(1)}s`)
  console.log(`Suites: ${results.length - failed.length}/${results.length} passed`)

  if (allPassed) {
    console.log('\n╔══════════════════════════════════════════════════════════╗')
    console.log('║  🚀 VERDICT: SAFE TO LAUNCH                             ║')
    console.log('║  All validation suites passed.                          ║')
    console.log('╚══════════════════════════════════════════════════════════╝')
    process.exit(0)
  } else {
    console.log('\n╔══════════════════════════════════════════════════════════╗')
    console.log('║  🛑 VERDICT: DO NOT LAUNCH                              ║')
    console.log('║  Resolve failures before going live.                    ║')
    console.log('╚══════════════════════════════════════════════════════════╝')
    console.log('\nFailed suites:')
    for (const f of failed) {
      console.log(`  • ${f.suite}`)
    }
    process.exit(1)
  }
}

main()
