#!/usr/bin/env node

/**
 * Netlify Operations — deploy verification, CDN purge, and cache diagnostics.
 *
 * Usage:
 *   node scripts/netlify-ops.mjs <action> [options]
 *
 * Actions:
 *   status          Show the latest deploy status
 *   purge           Purge the Netlify CDN (Durable + Edge) cache
 *   verify          Run all cache-header & chunk-integrity checks
 *   full            status → purge → wait → verify  (post-deploy flow)
 *   headers <path>  Inspect response headers for a specific path
 *
 * Environment:
 *   NETLIFY_TOKEN   Personal access token  (required for status/purge/full)
 *                   Get one at https://app.netlify.com/user/applications
 *
 * Examples:
 *   NETLIFY_TOKEN=nfp_xxx node scripts/netlify-ops.mjs full
 *   node scripts/netlify-ops.mjs verify
 *   node scripts/netlify-ops.mjs headers /barber/login
 */

// ─── Config ──────────────────────────────────────────────────
const SITE_ID = 'eed7ce51-54b7-4340-9420-8de7a77d9a95'
const SITE_URL = 'https://ramel-barbershop.netlify.app'
const API_BASE = 'https://api.netlify.com/api/v1'

const PAGES_TO_VERIFY = [
  '/',
  '/barber/login',
  '/barber/dashboard',
  '/my-appointments',
  '/notifications',
  '/login',
  '/profile',
  '/faq',
  '/terms',
  '/products',
]

const PURGE_WAIT_SECONDS = 12

// ─── Colours ─────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
}

const ok = (msg) => console.log(`  ${c.green}✓${c.reset} ${msg}`)
const fail = (msg) => console.log(`  ${c.red}✗${c.reset} ${msg}`)
const warn = (msg) => console.log(`  ${c.yellow}⚠${c.reset} ${msg}`)
const info = (msg) => console.log(`  ${c.cyan}ℹ${c.reset} ${msg}`)
const heading = (msg) => console.log(`\n${c.bold}${c.magenta}── ${msg} ──${c.reset}`)

// ─── Helpers ─────────────────────────────────────────────────

const getToken = () => {
  const token = process.env.NETLIFY_TOKEN
  if (!token) {
    console.error(
      `${c.red}Error:${c.reset} NETLIFY_TOKEN env var is required.\n` +
      `  Get one at: https://app.netlify.com/user/applications\n` +
      `  Usage: NETLIFY_TOKEN=nfp_xxx node scripts/netlify-ops.mjs <action>`
    )
    process.exit(1)
  }
  return token
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const fetchHeaders = async (path) => {
  const url = `${SITE_URL}${path}`
  const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
  const headers = {}
  res.headers.forEach((v, k) => { headers[k] = v })
  return { status: res.status, headers }
}

const fetchHtml = async (path) => {
  const url = `${SITE_URL}${path}`
  const res = await fetch(url)
  return res.text()
}

// ─── Actions ─────────────────────────────────────────────────

const actionStatus = async () => {
  heading('Deploy Status')
  const token = getToken()

  const res = await fetch(
    `${API_BASE}/sites/${SITE_ID}/deploys?per_page=5`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const deploys = await res.json()

  if (!Array.isArray(deploys) || deploys.length === 0) {
    fail('Could not fetch deploys.')
    return false
  }

  console.log('')
  console.log(
    `  ${'State'.padEnd(8)} ${'Commit'.padEnd(10)} ${'Time'.padEnd(6)} Created`
  )
  console.log(`  ${'─'.repeat(55)}`)

  for (const d of deploys) {
    const stateColour =
      d.state === 'ready' ? c.green : d.state === 'error' ? c.red : c.yellow
    const commit = (d.commit_ref || '?').slice(0, 8)
    const time = d.deploy_time ? `${d.deploy_time}s` : '-'
    const created = d.created_at?.replace('T', ' ').slice(0, 19) || '?'

    console.log(
      `  ${stateColour}${d.state.padEnd(8)}${c.reset} ${commit.padEnd(10)} ${time.padEnd(6)} ${created}`
    )
  }

  const latest = deploys[0]
  console.log('')
  if (latest.state === 'ready') {
    ok(`Latest deploy is ${c.green}ready${c.reset}`)
    return true
  }
  if (latest.state === 'error') {
    fail(`Latest deploy ${c.red}failed${c.reset}: ${latest.error_message || 'unknown error'}`)
    return false
  }
  warn(`Latest deploy state: ${latest.state} (may still be building)`)
  return false
}

const actionPurge = async () => {
  heading('Purge Netlify CDN Cache')
  const token = getToken()

  info('Sending purge request...')
  const res = await fetch(`${API_BASE}/purge`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ site_id: SITE_ID }),
  })

  if (res.status === 202) {
    ok(`Purge accepted (HTTP ${res.status}). CDN cache will clear within seconds.`)
    return true
  }

  fail(`Purge failed: HTTP ${res.status}`)
  console.log(`  Response: ${await res.text()}`)
  return false
}

const actionVerify = async () => {
  heading('Cache Header Verification')
  let allPassed = true
  let passCount = 0
  let failCount = 0

  // ── 1. Check every page for correct cache behaviour ─────
  // Grab reference deploy token from homepage to compare
  const refHtml = await fetchHtml('/')
  const refDpl = refHtml.match(/dpl=([a-f0-9]+)/)?.[1] || ''

  for (const path of PAGES_TO_VERIFY) {
    const { status, headers } = await fetchHeaders(path)
    const cacheStatus = headers['cache-status'] || ''
    const cacheControl = headers['cache-control'] || ''
    const prerender = headers['x-nextjs-prerender']
    const durablePart = cacheStatus.split(',').find((s) => s.includes('Durable')) || ''
    const durableBypass = durablePart.includes('fwd=bypass')
    const durableStale = durablePart.includes('fwd=stale')
    const durableStored = durablePart.includes('stored')

    if (status !== 200) {
      fail(`${path}  →  HTTP ${status}`)
      failCount++
      allPassed = false
      continue
    }

    // Extract TTL from durable part (e.g. "ttl=-40" or "ttl=31534563")
    const ttlMatch = durablePart.match(/ttl=(-?\d+)/)
    const ttl = ttlMatch ? parseInt(ttlMatch[1], 10) : null

    // A long positive TTL (> 1 day) means the plugin stored a 1-year cache — bad
    const longTtl = ttl !== null && ttl > 86400

    // Check if this page's deploy token matches the current deploy
    let deployMismatch = false
    if (durableStale && refDpl) {
      const pageHtml = await fetchHtml(path)
      const pageDpl = pageHtml.match(/dpl=([a-f0-9]+)/)?.[1] || ''
      deployMismatch = pageDpl !== '' && pageDpl !== refDpl
    }

    const problems = []
    if (longTtl) problems.push(`Durable TTL is dangerously long (${ttl}s ≈ ${Math.round(ttl / 86400)}d)`)
    if (deployMismatch) problems.push('Serving HTML from a DIFFERENT deploy (stale chunks!)')
    if (prerender) problems.push(`x-nextjs-prerender detected`)

    if (problems.length > 0) {
      fail(`${path}  →  ${problems.join(', ')}`)
      console.log(`    ${c.dim}cache-status: ${cacheStatus}${c.reset}`)
      console.log(`    ${c.dim}cache-control: ${cacheControl}${c.reset}`)
      failCount++
      allPassed = false
    } else if (durableStale && !longTtl && !deployMismatch) {
      // Short-TTL stale with matching deploy = benign SWR, content is current
      const ttlLabel = ttl !== null ? `ttl=${ttl}s` : ''
      warn(`${path}  →  ${c.yellow}Durable=SWR${c.reset} (${ttlLabel}, same deploy — benign)`)
      passCount++
    } else {
      const durableLabel = durableBypass
        ? `${c.green}Durable=bypass${c.reset}`
        : `${c.dim}Durable=?${c.reset}`
      ok(`${path}  →  ${durableLabel}  cache-control: ${cacheControl}`)
      passCount++
    }
  }

  // ── 2. Verify chunk integrity ───────────────────────────
  heading('Chunk Integrity')

  const html = await fetchHtml('/')
  const chunkPattern = /\/_next\/static\/chunks\/[a-f0-9]+\.(js|css)/g
  const chunks = [...new Set(html.match(chunkPattern) || [])]

  if (chunks.length === 0) {
    warn('No chunks found in homepage HTML')
  } else {
    info(`Found ${chunks.length} unique chunks in homepage HTML`)

    const sampled = chunks.slice(0, 8)
    for (const chunk of sampled) {
      const res = await fetch(`${SITE_URL}${chunk}`, { method: 'HEAD' })
      const ct = res.headers.get('content-type') || ''
      const cc = res.headers.get('cache-control') || ''

      if (res.status !== 200) {
        fail(`${chunk}  →  HTTP ${res.status}  ${c.red}MISSING${c.reset}`)
        failCount++
        allPassed = false
      } else if (ct.includes('text/plain')) {
        fail(`${chunk}  →  MIME ${ct}  ${c.red}WRONG TYPE${c.reset}`)
        failCount++
        allPassed = false
      } else {
        ok(`${chunk.split('/').pop()}  →  ${res.status}  ${ct.split(';')[0]}  ${cc}`)
        passCount++
      }
    }

    if (chunks.length > sampled.length) {
      info(`${c.dim}(sampled ${sampled.length} of ${chunks.length} chunks)${c.reset}`)
    }
  }

  // ── 3. Check turbopack runtime ──────────────────────────
  heading('Turbopack Runtime')

  const turboChunks = html.match(/\/_next\/static\/chunks\/turbopack-[a-f0-9]+\.js/g) || []
  if (turboChunks.length === 0) {
    info('No turbopack runtime chunk found (may use webpack)')
  } else {
    for (const tc of [...new Set(turboChunks)]) {
      const res = await fetch(`${SITE_URL}${tc}`, { method: 'HEAD' })
      const ct = res.headers.get('content-type') || ''
      if (res.status === 200 && ct.includes('javascript')) {
        ok(`${tc.split('/').pop()}  →  ${res.status} ${ct.split(';')[0]}`)
        passCount++
      } else {
        fail(`${tc.split('/').pop()}  →  HTTP ${res.status}  MIME ${ct}`)
        failCount++
        allPassed = false
      }
    }
  }

  // ── 4. Verify static assets cache headers ───────────────
  heading('Static Asset Caching')

  const firstChunk = chunks[0]
  if (firstChunk) {
    const { headers } = await fetchHeaders(firstChunk)
    const cc = headers['cache-control'] || ''
    if (cc.includes('immutable') && cc.includes('max-age=31536000')) {
      ok(`Static chunks use immutable 1-year cache  (${cc})`)
      passCount++
    } else {
      fail(`Static chunks have wrong cache: ${cc}`)
      failCount++
      allPassed = false
    }
  }

  // ── 5. Repeat-request test (Durable Cache build-up) ─────
  heading('Durable Cache Build-Up Test')
  info('Requesting /barber/login twice with 2s gap...')

  await fetchHeaders('/barber/login')
  await sleep(2000)
  const { headers: h2 } = await fetchHeaders('/barber/login')
  const cs2 = h2['cache-status'] || ''

  const durablePart2 = cs2.split(',').find((s) => s.includes('Durable')) || ''
  const ttlMatch2 = durablePart2.match(/ttl=(-?\d+)/)
  const ttl2 = ttlMatch2 ? parseInt(ttlMatch2[1], 10) : null
  const longTtl2 = ttl2 !== null && ttl2 > 86400
  const durableOk2 =
    durablePart2.includes('fwd=bypass') || durablePart2.includes('fwd=miss')
  const durableStaleNow2 = durablePart2.includes('fwd=stale')

  if (durableOk2) {
    ok(`Second request: Durable cache bypassed  (${durablePart2.trim()})`)
    passCount++
  } else if (durableStaleNow2 && longTtl2) {
    fail(`Second request: Durable cache has dangerous long TTL (${ttl2}s)`)
    info(`The plugin is applying 1-year cache. Run: ${c.cyan}npm run netlify:purge${c.reset}`)
    failCount++
    allPassed = false
  } else if (durableStaleNow2 && !longTtl2) {
    ok(`Second request: Durable SWR with short TTL (${ttl2}s) — content is fresh`)
    passCount++
  } else {
    warn(`Second request: unexpected  (${cs2})`)
  }

  // ── Summary ─────────────────────────────────────────────
  heading('Summary')
  console.log(`  ${c.green}Passed: ${passCount}${c.reset}    ${c.red}Failed: ${failCount}${c.reset}`)

  if (allPassed) {
    console.log(`\n  ${c.bold}${c.green}All checks passed — site is serving fresh content.${c.reset}\n`)
  } else {
    console.log(
      `\n  ${c.bold}${c.red}Some checks failed.${c.reset}\n` +
      `  Try: ${c.cyan}NETLIFY_TOKEN=... node scripts/netlify-ops.mjs purge${c.reset}\n` +
      `  Then re-run: ${c.cyan}node scripts/netlify-ops.mjs verify${c.reset}\n`
    )
  }

  return allPassed
}

const actionHeaders = async (path) => {
  if (!path) {
    console.error(`Usage: node scripts/netlify-ops.mjs headers /some/path`)
    process.exit(1)
  }

  if (!path.startsWith('/')) path = `/${path}`

  heading(`Headers for ${path}`)
  const { status, headers } = await fetchHeaders(path)

  console.log(`  ${c.bold}HTTP ${status}${c.reset}\n`)

  const important = [
    'cache-control', 'cache-status', 'netlify-cdn-cache-control',
    'content-type', 'age', 'etag', 'x-nextjs-prerender',
    'x-nextjs-date', 'x-nextjs-stale-time', 'netlify-vary',
    'x-nf-request-id', 'x-content-type-options',
  ]

  for (const key of important) {
    if (headers[key]) {
      const colour = key.includes('cache') ? c.cyan : c.dim
      console.log(`  ${colour}${key}:${c.reset} ${headers[key]}`)
    }
  }

  const extras = Object.keys(headers).filter(
    (k) => !important.includes(k) && !['date', 'server', 'strict-transport-security', 'vary'].includes(k)
  )
  if (extras.length > 0) {
    console.log(`\n  ${c.dim}Other headers:${c.reset}`)
    for (const k of extras) {
      console.log(`  ${c.dim}${k}:${c.reset} ${headers[k]}`)
    }
  }
  console.log('')
}

const actionFull = async () => {
  console.log(`\n${c.bold}${c.magenta}╔══════════════════════════════════════╗${c.reset}`)
  console.log(`${c.bold}${c.magenta}║   Netlify Post-Deploy Full Check     ║${c.reset}`)
  console.log(`${c.bold}${c.magenta}╚══════════════════════════════════════╝${c.reset}`)

  // Step 1: Status
  const deployReady = await actionStatus()
  if (!deployReady) {
    warn('Latest deploy is not ready. Continuing anyway...')
  }

  // Step 2: Purge
  const purged = await actionPurge()
  if (!purged) {
    fail('Purge failed. Aborting.')
    process.exit(1)
  }

  // Step 3: Wait for purge to propagate
  heading('Waiting for CDN Purge Propagation')
  for (let i = PURGE_WAIT_SECONDS; i > 0; i--) {
    process.stdout.write(`\r  ${c.dim}Waiting ${i}s...${c.reset}   `)
    await sleep(1000)
  }
  process.stdout.write(`\r  ${c.green}Purge propagated.${c.reset}              \n`)

  // Step 4: Verify
  const passed = await actionVerify()
  process.exit(passed ? 0 : 1)
}

// ─── CLI Router ──────────────────────────────────────────────

const [action, ...args] = process.argv.slice(2)

const actions = {
  status: actionStatus,
  purge: actionPurge,
  verify: actionVerify,
  full: actionFull,
  headers: () => actionHeaders(args[0]),
}

if (!action || !actions[action]) {
  console.log(`
${c.bold}Netlify Operations${c.reset}
${c.dim}Deploy verification, CDN purge, and cache diagnostics.${c.reset}

${c.bold}Usage:${c.reset}
  node scripts/netlify-ops.mjs ${c.cyan}<action>${c.reset} [options]

${c.bold}Actions:${c.reset}
  ${c.cyan}status${c.reset}            Show latest deploy status
  ${c.cyan}purge${c.reset}             Purge the Netlify CDN cache
  ${c.cyan}verify${c.reset}            Run all cache-header & chunk-integrity checks
  ${c.cyan}full${c.reset}              status → purge → wait → verify  ${c.dim}(post-deploy flow)${c.reset}
  ${c.cyan}headers${c.reset} <path>    Inspect response headers for a specific path

${c.bold}Environment:${c.reset}
  ${c.yellow}NETLIFY_TOKEN${c.reset}     Required for status/purge/full
                    Get one at: https://app.netlify.com/user/applications

${c.bold}Examples:${c.reset}
  NETLIFY_TOKEN=nfp_xxx node scripts/netlify-ops.mjs full
  node scripts/netlify-ops.mjs verify
  node scripts/netlify-ops.mjs headers /barber/login

${c.bold}npm shortcuts:${c.reset}
  npm run netlify:status
  npm run netlify:purge
  npm run netlify:verify
  npm run netlify:full
`)
  process.exit(action ? 1 : 0)
}

try {
  const result = await actions[action]()
  if (action !== 'full' && action !== 'headers') {
    process.exit(result ? 0 : 1)
  }
} catch (err) {
  console.error(`\n${c.red}Error:${c.reset} ${err.message}`)
  if (err.cause) console.error(`  ${c.dim}Cause: ${err.cause}${c.reset}`)
  process.exit(1)
}
