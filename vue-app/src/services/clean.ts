import type { BOMFile } from '../types/file'
import { type TableData, type TableRow } from '../types/table'
import { COLORS } from '../constants'

/**
 * 入口函数（异步）
 * 输入：BOMFile（original 中是解析得到的原始表）
 * 处理：按步骤对 original.rows 进行清洗（不修改原始行数据，仅在需要删除时标记 hasCleaned = true）
 * 输出：返回 Promise<BOMFile>，其中 cleaned 为清洗后的表，且 cleaned.rows 的 index 连续重排；rows 为清洗后的总行数
 */
export async function cleanBOM(file: BOMFile): Promise<BOMFile> {
    const original = file.original
    const headers = [...(original?.headers ?? [])]
    const originalRows = original?.rows ?? []

    // 保护：若无数据，返回空清洗结果
    if (!original || headers.length === 0 || originalRows.length === 0) {
        const empty: TableData = {
            headers,
            rows: [],
            metadata: {
                rowCount: 0,
                columnCount: headers.length,
                importTime: new Date()
            }
        }
        return {
            ...file,
            cleaned: empty,
            rows: 0
        }
    }

    // 常用列名（中文）
    const COL_PN = '零件号'
    const COL_SUPPN = '供应商零件号'
    const COL_QTY = '数量'
    const COL_TYPE = '类型'

    // ---------- 单次遍历：完成 Step 1、2 并执行 Step 3 聚合/标记 ----------
    const TYPE_SET = new Set(['WIRE', '线束', '导线'])
    const groups = new Map<string, { data: Record<string, any>; sourceIndexes: number[]; qty: number }>()

    for (let idx = 0; idx < originalRows.length; idx++) {
        const src = originalRows[idx]
        const srcData = src?.data ?? {}
        // 构造临时工作数据（不修改原始数据）
        const row: Record<string, any> = {}
        for (const h of headers) row[h] = srcData[h]

        // Step 1. PN 填充
        const pnRaw = safeString(row[COL_PN])
        const spnRaw = safeString(row[COL_SUPPN])
        if (!pnRaw && spnRaw) row[COL_PN] = `[${spnRaw}]`

        // Step 2. 关键列规整 + 数量数值化
        if (COL_PN in row) row[COL_PN] = normalizeKey(safeString(row[COL_PN]))
        if (COL_SUPPN in row) row[COL_SUPPN] = normalizeKey(safeString(row[COL_SUPPN]))
        if (COL_QTY in row) {
            const n = toNumber(row[COL_QTY])
            row[COL_QTY] = Number.isFinite(n) ? n : 0
        } else {
            row[COL_QTY] = 0
        }

        // Step 3. 类型规范化与 PN 聚合键
        const type = safeString(row[COL_TYPE])
        let pn = safeString(row[COL_PN])
        if (pn && TYPE_SET.has(type)) {
            const parts = pn.split('-')
            if (parts.length >= 3) pn = `${parts[0]}-${parts[1]}`
        }
        // 将规范化后的 PN 回写到行数据，保证展示使用规范化值
        row[COL_PN] = pn

        const key = pn
        const qty = Number(row[COL_QTY]) || 0

        if (!groups.has(key)) {
            // 首次出现：复制为聚合基准，原始行标记为未清理
            const base: Record<string, any> = {}
            for (const h of headers) base[h] = row[h]
            base[COL_QTY] = qty
            groups.set(key, { data: base, sourceIndexes: [idx], qty })
            src.hasCleaned = false
        } else {
            // 追加同键：数量累加，当前原始行即时标记清理
            const g = groups.get(key)!
            g.qty += qty
            g.data[COL_QTY] = g.qty
            g.sourceIndexes.push(idx)
            src.hasCleaned = true
            // 标记原始被合并/删除的行为灰色，供原始视图直接取色
            src.colorCategory = COLORS.PURPLE
        }
    }

    // ---------- 排序（自然排序，按“零件号”升序） ----------
    const aggregatedRows: TableRow[] = Array.from(groups.values()).map((g, idx) => ({
        data: g.data,
        index: idx, // 先占位，稍后重排
        colorCategory: COLORS.DEFAULT,
        hasCleaned: false
    }))

    aggregatedRows.sort((a, b) => naturalCompare(safeString(a.data[COL_PN]), safeString(b.data[COL_PN])))

    // 重排 index：从 0..n-1
    aggregatedRows.forEach((r, i) => { r.index = i })

    // 构造 cleaned 表
    const cleaned: TableData = {
        headers,
        rows: aggregatedRows,
        metadata: {
            rowCount: aggregatedRows.length,
            columnCount: headers.length,
            importTime: new Date()
        }
    }

    // 兜底：对未赋值的行补齐 hasCleaned=false（步骤1/2不产生可见删除）
    for (const r of originalRows) {
        if (r.hasCleaned !== true) r.hasCleaned = false
    }

    return {
        ...file,
        cleaned,
        rows: cleaned.rows.length
    }
}

// =============== 工具函数（顺序放在末尾） ===============

// 将任意值转为安全字符串
function safeString(v: any): string { return v == null ? '' : String(v) }

// 关键列规整：去不可见字符与空白
function normalizeKey(s: string): string {
    // 删除 U+200B..U+200D、U+FEFF、U+00AD、NBSP，以及所有空白字符
    return s
        .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
        .replace(/[\u00A0\s]+/g, '')
}

// 数量转数字
function toNumber(v: any): number {
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
        const s = v.replace(/[,\s]/g, '') // 去除逗号与空白
        const n = Number(s)
        return Number.isFinite(n) ? n : NaN
    }
    return Number(v)
}

// 自然排序（按字符串数字化比较）
function naturalCompare(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}
