// @ts-nocheck
// 简单验证：解析后重排表头不会影响清洗逻辑
const fs = await import('fs')
const path = await import('path')
const url = await import('url')
import { parseHTMLWithSheetJS } from '../src/services/parsing'
import { cleanBOM } from '../src/services/clean'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function run(fileName: string) {
    const p = path.resolve(__dirname, fileName)
    const html = fs.readFileSync(p, 'utf-8')
    const parsed = await parseHTMLWithSheetJS(html, fileName)
    const cleaned = await cleanBOM(parsed)
    const h0 = parsed.original.headers
    const h1 = cleaned.cleaned.headers
    console.log(`\n[${fileName}] 原始表头(前4):`, h0.slice(0, 4))
    console.log(`[${fileName}] 清洗表头(前4):`, h1.slice(0, 4))
    console.log(`[${fileName}] 行数: 原始 ${parsed.rows} / 清洗 ${cleaned.rows}`)
}

await run('single-table.html')
await run('mul-table.html')
