import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(process.cwd())
const svgPath = path.join(root, 'public', 'by-logo.svg')
const outPath = path.join(root, 'public', 'by-logo.png')

if (!fs.existsSync(svgPath)) {
  console.error(`Missing ${svgPath}`)
  process.exit(1)
}

const svg = fs.readFileSync(svgPath)

await sharp(svg)
  .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ quality: 100 })
  .toFile(outPath)

console.log(`Generated ${outPath}`)
