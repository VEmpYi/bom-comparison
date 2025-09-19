import type { BOMFile } from '../types/file'
// colorCategory is now COLORS enum string
import { COLORS, COLUMN_NAMES, WIRE_TYPES } from '../constants'
import { sortByColorThenPN, colorToPriority } from '../utils/text'
import { compareWires } from './compare'

export const fillSolid = (argb: string) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

export function priorityFill(p: number) {
    switch (p) {
        case 0: return fillSolid(COLORS.LIGHT_RED)
        case 1: return fillSolid(COLORS.ORANGE)
        case 2: return fillSolid(COLORS.LIGHT_BLUE)
        case 3: return fillSolid(COLORS.LIGHT_GREEN)
        default: return undefined
    }
}

// 排序采用共享工具，颜色优先 + PN 自然排序
const sortRowsByPriorityThenPN = (rows: any[]) => sortByColorThenPN(rows, COLUMN_NAMES.PART_NUMBER)

export function applyBordersForRange(ws: any, r1: number, c1: number, r2: number, c2: number) {
    r1 = Math.max(1, Math.floor(r1))
    c1 = Math.max(1, Math.floor(c1))
    r2 = Math.max(r1, Math.floor(r2))
    c2 = Math.max(c1, Math.floor(c2))
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            const cell = ws.getCell(r, c)
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        }
    }
}

export function autoFitColumns(ws: any, minWidth = 10, maxWidth = 40) {
    const cols = ws.columns || []
    cols.forEach((col: any) => {
        let maxLen = 0
        col.eachCell({ includeEmpty: true }, (cell: any) => {
            const v = cell.value
            let l = 0
            if (v == null) l = 0
            else if (typeof v === 'object') {
                if (Array.isArray((v as any).richText)) l = (v as any).richText.map((t: any) => t.text || '').join('').length
                else if ((v as any).text != null) l = String((v as any).text).length
                else l = String(v).length
            } else l = String(v).length
            if (l > maxLen) maxLen = l
        })
        col.width = Math.min(maxWidth, Math.max(minWidth, maxLen + 2))
    })
}

export async function downloadWorkbook(wb: any, filename: string) {
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

export function sanitizeSheetName(name: string, usedNames: Set<string>) {
    let cleaned = String(name).replace(/[\\\/:\*\?\[\]]/g, '_')
    cleaned = cleaned.substring(0, 31)
    let candidate = cleaned
    let counter = 1
    while (usedNames.has(candidate)) {
        const suffix = `_${counter}`
        const maxBase = 31 - suffix.length
        candidate = cleaned.substring(0, maxBase) + suffix
        counter++
    }
    usedNames.add(candidate)
    return candidate
}

export function sanitizeFileBase(name: string) {
    return String(name).replace(/\.[^.]+$/, '').replace(/[^\u4e00-\u9fa5\w-]+/g, '_')
}

export function createWorkbook() {
    return new (window as any).ExcelJS.Workbook()
}

// =============== 新增：BOM 导出主函数 ===============

/**
 * 导出两个 BOMFile 到一个 .xlsx，多 Sheet：
 * - 单表（right 未传）：原样数据（不着色），含表头、筛选、边框、自适应列宽
 * - 两表未对比：两张原样工作表
 * - 两表已对比：
 *   - 左右两张着色工作表，并新增“对比标记”列（未找到/供应商匹配/数量不同/数量相同）
 *   - “对比结果”汇总页：图例、左右小计（红/蓝/橙/绿）及着色数据视图、导线长度差值（左右各一块）
 */
export async function exportBOMPairToXlsx(left: BOMFile, right?: BOMFile, fileName?: string) {
    const wb = createWorkbook()
    const used = new Set<string>()

    const addRawSheet = (file: BOMFile) => {
        const headers = file.cleaned.headers
        const rows = file.cleaned.rows
        const name = sanitizeSheetName(file.name || 'Sheet', used)
        const ws = wb.addWorksheet(name)

        // 表头
        ws.addRow(headers)
        // 数据
        for (const r of rows) {
            ws.addRow(headers.map(h => r.data[h]))
        }
        // 列筛选
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
        // 边框 & 列宽
        if (rows.length > 0) applyBordersForRange(ws, 1, 1, rows.length + 1, headers.length)
        autoFitColumns(ws)
        return ws
    }

    const categoryText = (cat?: string) => {
        switch (cat) {
            case COLORS.LIGHT_RED: return '未找到'
            case COLORS.ORANGE: return '供应商匹配'
            case COLORS.LIGHT_BLUE: return '数量不同'
            case COLORS.LIGHT_GREEN: return '数量相同'
            default: return ''
        }
    }

    const addColoredSheet = (file: BOMFile) => {
        const baseHeaders = file.cleaned.headers
        const headers = [...baseHeaders, COLUMN_NAMES.COMPARE_TAG]
        const rows = sortRowsByPriorityThenPN(file.cleaned.rows)
        const name = sanitizeSheetName(`${file.name}`, used)
        const ws = wb.addWorksheet(name)
        ws.addRow(headers)
        // 数据 + 背景色 + 对比标记
        for (const r of rows) {
            const values = baseHeaders.map(h => r.data[h])
            values.push(categoryText(r.colorCategory))
            const row = ws.addRow(values)
            if (r.colorCategory) {
                row.eachCell((cell: any) => { cell.fill = fillSolid(r.colorCategory as string) })
            }
        }
        // 筛选/边框/列宽
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
        if (rows.length > 0) applyBordersForRange(ws, 1, 1, rows.length + 1, headers.length)
        autoFitColumns(ws)
        return ws
    }

    const isCompared = (file: BOMFile) => file.cleaned.rows.some(r => r.colorCategory)

    if (!right) {
        // 单表导出
        addRawSheet(left)
    } else {
        const compared = isCompared(left) || isCompared(right)
        if (!compared) {
            // 两表未对比：两张原样工作表
            addRawSheet(left)
            addRawSheet(right)
        } else {
            // 两表已对比：两张着色表 + 汇总页
            addColoredSheet(left)
            addColoredSheet(right)
            await addSummarySheet(wb, left, right, used)
        }
    }

    const base = sanitizeFileBase(fileName || `${left?.name || 'Left'}${right ? '_' + right.name : ''}`)
    await downloadWorkbook(wb, `${base}.xlsx`)
}

// =============== 汇总页 ===============

async function addSummarySheet(wb: any, left: BOMFile, right: BOMFile, used: Set<string>) {
    const ws = wb.addWorksheet(sanitizeSheetName('对比结果', used))

    // 图例
    ws.getCell(1, 1).value = '图例'
    ws.getCell(1, 1).fill = fillSolid(COLORS.LIGHT_GRAY)
    ws.getCell(3, 1).value = '零件号不存在'
    ws.getCell(3, 1).fill = fillSolid(COLORS.LIGHT_RED)
    ws.getCell(4, 1).value = '虽无零件号，但供应商零件号匹配'
    ws.getCell(4, 1).fill = fillSolid(COLORS.ORANGE)
    ws.getCell(5, 1).value = '数量不同'
    ws.getCell(5, 1).fill = fillSolid(COLORS.LIGHT_BLUE)
    ws.getCell(6, 1).value = '完全一致'
    ws.getCell(6, 1).fill = fillSolid(COLORS.LIGHT_GREEN)
    applyBordersForRange(ws, 1, 1, 1, 1)
    applyBordersForRange(ws, 3, 1, 6, 1)

    // 左右小计与数据视图
    const viewHeaders = ['零件号', '供应商零件号', '类型', '数量']
    // 左侧
    ws.getCell(1, 3).value = left.name
    ws.getCell(1, 3).fill = fillSolid(COLORS.GRAY)
    const leftCounts = countByColors(left)
    // C2~F2: 红 蓝 橙 绿
    ws.getCell(2, 3).value = leftCounts.red; ws.getCell(2, 3).fill = fillSolid(COLORS.LIGHT_RED)
    ws.getCell(2, 4).value = leftCounts.blue; ws.getCell(2, 4).fill = fillSolid(COLORS.LIGHT_BLUE)
    ws.getCell(2, 5).value = leftCounts.orange; ws.getCell(2, 5).fill = fillSolid(COLORS.ORANGE)
    ws.getCell(2, 6).value = leftCounts.green; ws.getCell(2, 6).fill = fillSolid(COLORS.LIGHT_GREEN)
    applyBordersForRange(ws, 1, 3, 2, 6)
    // 表头 C3~F3
    for (let i = 0; i < viewHeaders.length; i++) ws.getCell(3, 3 + i).value = viewHeaders[i]
    applyBordersForRange(ws, 3, 3, 3, 6)
    // 数据 C4~
    let rowPtr = 4
    for (const r of sortRowsByPriorityThenPN(left.cleaned.rows)) {
        const vals = [r.data[COLUMN_NAMES.PART_NUMBER], r.data[COLUMN_NAMES.SUPPLIER_PART_NUMBER], r.data[COLUMN_NAMES.TYPE], r.data[COLUMN_NAMES.QUANTITY]]
        for (let i = 0; i < vals.length; i++) ws.getCell(rowPtr, 3 + i).value = vals[i]
        if (r.colorCategory) { for (let c = 3; c <= 6; c++) ws.getCell(rowPtr, c).fill = fillSolid(r.colorCategory as string) }
        rowPtr++
    }
    if (rowPtr > 4) applyBordersForRange(ws, 4, 3, rowPtr - 1, 6)

    // 右侧 H1~K
    ws.getCell(1, 8).value = right.name
    ws.getCell(1, 8).fill = fillSolid(COLORS.GRAY)
    const rightCounts = countByColors(right)
    ws.getCell(2, 8).value = rightCounts.red; ws.getCell(2, 8).fill = fillSolid(COLORS.LIGHT_RED)
    ws.getCell(2, 9).value = rightCounts.blue; ws.getCell(2, 9).fill = fillSolid(COLORS.LIGHT_BLUE)
    ws.getCell(2, 10).value = rightCounts.orange; ws.getCell(2, 10).fill = fillSolid(COLORS.ORANGE)
    ws.getCell(2, 11).value = rightCounts.green; ws.getCell(2, 11).fill = fillSolid(COLORS.LIGHT_GREEN)
    applyBordersForRange(ws, 1, 8, 2, 11)
    ws.getRow(3).getCell(8).value = viewHeaders[0]
    ws.getRow(3).getCell(9).value = viewHeaders[1]
    ws.getRow(3).getCell(10).value = viewHeaders[2]
    ws.getRow(3).getCell(11).value = viewHeaders[3]
    applyBordersForRange(ws, 3, 8, 3, 11)
    let rowPtrR = 4
    for (const r of sortRowsByPriorityThenPN(right.cleaned.rows)) {
        const vals = [r.data[COLUMN_NAMES.PART_NUMBER], r.data[COLUMN_NAMES.SUPPLIER_PART_NUMBER], r.data[COLUMN_NAMES.TYPE], r.data[COLUMN_NAMES.QUANTITY]]
        ws.getRow(rowPtrR).getCell(8).value = vals[0]
        ws.getRow(rowPtrR).getCell(9).value = vals[1]
        ws.getRow(rowPtrR).getCell(10).value = vals[2]
        ws.getRow(rowPtrR).getCell(11).value = vals[3]
        if (r.colorCategory) {
            for (let c = 8; c <= 11; c++) ws.getCell(rowPtrR, c).fill = fillSolid(r.colorCategory as string)
        }
        rowPtrR++
    }
    if (rowPtrR > 4) applyBordersForRange(ws, 4, 8, rowPtrR - 1, 11)

    // 导线长度差值（左表） M1 起（使用 compareWires，全量行，按零件号自然排序，差值上色）
    let cur = 1
    ws.getCell(cur, 13).value = '导线长度差值（左表）' // M1
    applyBordersForRange(ws, cur, 13, cur, 13)
    cur += 2 // 到 M3
    const diffHeaders = ['零件号', '类型', '本表数量', '对表数量', '差值']
    for (let i = 0; i < diffHeaders.length; i++) ws.getCell(cur, 13 + i).value = diffHeaders[i]
    applyBordersForRange(ws, cur, 13, cur, 17)
    const wires = await compareWires(left, right)
    const leftDiffRows = wires.left.map(w => ({
        '零件号': w['零件号'], '类型': w['类型'], '本表数量': w['本表数量'], '对表数量': w['对表数量'], '差值': w['本表数量'] - w['对表数量']
    }))
    leftDiffRows.sort((a, b) => String(a['零件号']).localeCompare(String(b['零件号']), undefined, { numeric: true, sensitivity: 'base' }))
    for (let i = 0; i < leftDiffRows.length; i++) {
        const r: any = leftDiffRows[i]
        const excelRow = ws.getRow(cur + 1 + i)
        excelRow.getCell(13).value = r['零件号']
        excelRow.getCell(14).value = r['类型']
        excelRow.getCell(15).value = r['本表数量']
        excelRow.getCell(16).value = r['对表数量']
        excelRow.getCell(17).value = r['差值']
        // 差值填色
        const diff = r['差值']
        if (diff > 0) excelRow.getCell(17).fill = fillSolid(COLORS.LIGHT_GREEN)
        else if (diff < 0) excelRow.getCell(17).fill = fillSolid(COLORS.LIGHT_RED)
    }
    if (leftDiffRows.length > 0) applyBordersForRange(ws, cur + 1, 13, cur + leftDiffRows.length, 17)

    // 右表差值，间隔一行
    cur = cur + (leftDiffRows.length > 0 ? leftDiffRows.length : 0) + 2
    ws.getCell(cur, 13).value = '导线长度差值（右表）'
    applyBordersForRange(ws, cur, 13, cur, 13)
    cur += 2
    for (let i = 0; i < diffHeaders.length; i++) ws.getCell(cur, 13 + i).value = diffHeaders[i]
    applyBordersForRange(ws, cur, 13, cur, 17)
    const rightDiffRows = wires.right.map(w => ({
        '零件号': w['零件号'], '类型': w['类型'], '本表数量': w['本表数量'], '对表数量': w['对表数量'], '差值': w['本表数量'] - w['对表数量']
    }))
    rightDiffRows.sort((a, b) => String(a['零件号']).localeCompare(String(b['零件号']), undefined, { numeric: true, sensitivity: 'base' }))
    for (let i = 0; i < rightDiffRows.length; i++) {
        const r: any = rightDiffRows[i]
        const excelRow = ws.getRow(cur + 1 + i)
        excelRow.getCell(13).value = r['零件号']
        excelRow.getCell(14).value = r['类型']
        excelRow.getCell(15).value = r['本表数量']
        excelRow.getCell(16).value = r['对表数量']
        excelRow.getCell(17).value = r['差值']
        const diff = r['差值']
        if (diff > 0) excelRow.getCell(17).fill = fillSolid(COLORS.LIGHT_GREEN)
        else if (diff < 0) excelRow.getCell(17).fill = fillSolid(COLORS.LIGHT_RED)
    }
    if (rightDiffRows.length > 0) applyBordersForRange(ws, cur + 1, 13, cur + rightDiffRows.length, 17)

    autoFitColumns(ws)
}

function countByColors(file: BOMFile) {
    let red = 0, orange = 0, blue = 0, green = 0
    for (const r of file.cleaned.rows) {
        switch (r.colorCategory) {
            case COLORS.LIGHT_RED: red++; break
            case COLORS.ORANGE: orange++; break
            case COLORS.LIGHT_BLUE: blue++; break
            case COLORS.LIGHT_GREEN: green++; break
        }
    }
    return { red, orange, blue, green }
}

function toNumberSafe(v: any): number {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0
    if (v == null) return 0
    const s = String(v).replace(/[\s,]/g, '')
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
}

// buildWireDiffRows: 已改为直接使用 compareWires 构建
