import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.CAPTURE_URL
const output = process.env.CAPTURE_DIR
if (!url || !output) {
  console.error('Set CAPTURE_URL and CAPTURE_DIR.')
  process.exit(1)
}

const runtime = process.env.OMGITHUB_PLAYWRIGHT_ROOT || join(process.env.HOME, '.local/share/omgithub-playwright')
const require = createRequire(join(runtime, 'package.json'))
const { chromium } = require('playwright')
const configFile = join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json')
const config = JSON.parse(readFileSync(configFile, 'utf8'))
if (process.platform === 'linux' && !process.env.DISPLAY) {
  process.env.DISPLAY = ':' + readFileSync(join(runtime, 'display'), 'utf8').trim()
}

function transient(error) {
  return Object.assign(error, { exitCode: 75 })
}

async function timed(label, run) {
  const started = Date.now()
  try {
    return await run()
  } finally {
    console.error(`[timing] ${label}: ${Date.now() - started} ms`)
  }
}

function transientStatus(status) {
  return status === 408 || status === 429 || status >= 500
}

async function main() {
  mkdirSync(output, { recursive: true })
  let browser
  try {
    browser = await timed('launch chromium', () =>
      chromium.launch({ ...config.browser.launchOptions, timeout: 30000 }).catch(transient)
    )

    for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
      const context = await timed(`new ${name} context`, () =>
        browser.newContext({
          viewport: { width, height },
          deviceScaleFactor: 1,
          isMobile: name === 'mobile',
          hasTouch: name === 'mobile'
        }).catch(transient)
      )
      const page = await timed(`new ${name} page`, () => context.newPage().catch(transient))
      page.setDefaultTimeout(30000)
      const pageErrors = []
      page.on('pageerror', error => {
        pageErrors.push(error.message)
        console.error(`[pageerror:${name}] ${error.message}`)
      })

      const response = await timed(`navigate ${name}`, () =>
        page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(error => {
          throw transient(error)
        })
      )
      if (!response) throw transient(new Error(`No HTTP response loading ${url}`))
      if (!response.ok()) {
        const error = new Error(`HTTP ${response.status()} loading ${url}`)
        if (transientStatus(response.status())) throw transient(error)
        error.exitCode = 1
        throw error
      }

      const readySelector = process.env.CAPTURE_READY_SELECTOR || 'html[data-app-ready="true"]'
      try {
        await timed(`wait ready ${name}`, () =>
          page.locator(readySelector).waitFor({ state: 'attached', timeout: 20000 })
        )
      } catch (error) {
        if (pageErrors.length) throw new Error(`Rendering failed: ${pageErrors[0]}`)
        throw new Error(`Rendering did not become ready (selector: ${readySelector})`)
      }

      await timed(`wait fonts ${name}`, () =>
        page.waitForFunction(() => document.fonts && document.fonts.status === 'loaded', null, { timeout: 15000 })
          .catch(() => {})
      )
      await timed(`settle ${name}`, () => page.waitForTimeout(900))

      const file = join(output, `final-${name}.png`)
      await timed(`screenshot ${name}`, () =>
        page.screenshot({ path: file, timeout: 30000, animations: 'disabled' }).catch(error => {
          if (error.name === 'TimeoutError' || !browser.isConnected()) throw transient(error)
          throw error
        })
      )
      const size = statSync(file).size
      if (size < 24) throw new Error(`Screenshot is empty: ${file}`)
      console.log(`Captured ${name}: ${file} (${size} bytes)`)

      await timed(`close ${name} page`, () => page.close())
      await timed(`close ${name} context`, () => context.close())
    }
  } finally {
    await timed('close browser', () => browser?.close()).catch(error => {
      console.error(error)
      process.exitCode ||= 75
    })
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = error.exitCode || 1
})
