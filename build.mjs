import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const started = Date.now()
const root = resolve(import.meta.dirname)
const source = join(root, 'src')
const destination = join(root, 'dist')

rmSync(destination, { recursive: true, force: true })
mkdirSync(destination, { recursive: true })
cpSync(source, destination, { recursive: true })

const files = readdirSync(destination).sort()
console.log(`Built ${files.length} files into ${destination}`)
for (const file of files) console.log(`  ${file}`)
console.log(`[timing] build: ${Date.now() - started} ms`)
