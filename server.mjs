import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname, 'dist')
const port = Number(process.env.PORT || 3000)
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
}

function safePath(pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const target = resolve(root, '.' + normalize(decoded))
  if (target !== root && !target.startsWith(root + sep)) return null
  return target
}

const server = createServer((request, response) => {
  const started = Date.now()
  const url = new URL(request.url || '/', 'http://localhost')
  let target = safePath(url.pathname)
  if (!target) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }
  let isDirectory = false
  try {
    isDirectory = statSync(target).isDirectory()
  } catch {
    isDirectory = false
  }
  if (isDirectory) target = join(target, 'index.html')
  if (!existsSync(target) && !extname(url.pathname)) target = join(root, 'index.html')
  if (!existsSync(target)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }

  response.writeHead(200, {
    'content-type': types[extname(target).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff'
  })
  if (request.method === 'HEAD') {
    response.end()
    return
  }
  const stream = createReadStream(target)
  stream.on('error', () => {
    response.destroy()
  })
  stream.pipe(response)
  response.on('finish', () => {
    console.log(`[timing] ${request.method} ${url.pathname} ${Date.now() - started} ms`)
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`PlayGround listening on http://0.0.0.0:${port} (root: ${root})`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    console.log(`Received ${signal}, shutting down`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 3000).unref()
  })
}
