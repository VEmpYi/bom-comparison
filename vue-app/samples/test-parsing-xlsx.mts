// @ts-nocheck
// 基于 ExcelJS 的 XLSX 解析测试脚本
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { parseXLSXWithExcelJS } from '../src/services/parsing';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readFileBuffer(p) {
    return fs.readFileSync(p);
}

async function runOne(file) {
    const abs = path.resolve(__dirname, file);
    const buf = readFileBuffer(abs);
    const res = await parseXLSXWithExcelJS(buf, path.basename(file));
    return res;
}

async function main() {
    const files = ['mul-table.xlsx', 'C100.xlsx'];
    const results = {};
    for (const f of files) {
        try {
            const r = await runOne(f);
            results[f] = r;
            console.log(`✔ ${f}: ${r.status}, 合并为 1 个表, 行 ${r.rows}, 列 ${r.original.headers.length}`);
        } catch (err) {
            console.error(`✘ ${f} 解析失败:`, err?.message ?? String(err));
            results[f] = { status: 'error', errorMsg: err?.message ?? String(err) };
        }
    }
    const out = path.resolve(__dirname, 'parsing-results-xlsx.json');
    fs.writeFileSync(out, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`📁 结果已保存: ${out}`);
}

main().catch(e => {
    console.error('运行失败:', e);
    process.exit(1);
});
