// @ts-nocheck
// 注：避免项目范围的 TS 配置变更，这里直接使用动态 import 以绕过类型检查对 Node 内置模块的需求
// 在 tsx 运行时这些模块都可用
const fs = await import('fs');
const path = await import('path');
const url = await import('url');
import { parseHTMLWithSheetJS } from '../src/services/parsing';

// Resolve __dirname in ESM
// 兼容 ESM 方式解析 __dirname
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function saveJSON(filePath: string, data: unknown) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function runOne(fileName: string) {
    const htmlPath = path.resolve(__dirname, fileName);
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    const result = await parseHTMLWithSheetJS(htmlContent, fileName);
    return result;
}

async function main() {
    const outPath = path.resolve(__dirname, 'parsing-results.json');
    const files = ['single-table.html', 'mul-table.html'];
    const results: Record<string, unknown> = {};

    for (const f of files) {
        try {
            const res = await runOne(f);
            results[f] = res;
            console.log(`✔ ${f}: ${res.status}, 合并为 1 个表, 行 ${res.rows}, 列 ${res.original.headers.length}`);
        } catch (err: any) {
            console.error(`✘ ${f} 解析失败:`, err?.message ?? String(err));
            results[f] = { status: 'error', errorMsg: err?.message ?? String(err) };
        }
    }

    saveJSON(outPath, results);
    console.log(`📁 结果已保存: ${outPath}`);
}

main();
