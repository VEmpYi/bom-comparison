/**
 * 文件解析服务
 * 使用SheetJS解析HTML格式文件，返回标准化的BOMFile数据结构
 */

import * as XLSX from 'xlsx'
import { TableData, TableRow } from '../types/table'
import { COLORS } from '../constants'
import { BOMFile } from '../types/file'
import { COLUMN_NAMES } from '../constants'

/**
 * 使用SheetJS解析HTML文件
 * @param htmlContent HTML文件内容字符串
 * @param fileName 文件名
 * @returns BOMFile格式的数据
 */
export async function parseHTMLWithSheetJS(htmlContent: string, fileName: string): Promise<BOMFile> {
    try {
        // 使用SheetJS读取HTML内容，强制字符串格式避免数据类型转换
        const workbook = XLSX.read(htmlContent, {
            type: 'string'
        })

        // 合并所有工作表中的表格为一个 TableData
        const mergedHeaders: string[] = []
        const mergedRows: TableRow[] = []
        let globalIndex = 0

        // 遍历所有工作表
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName]

            // 转换为二维数组格式
            const rawData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,     // 使用数组格式
                raw: false,    // 强制字符串
                defval: ''     // 空值默认为空字符串
            }) as string[][]

            // 查找表头行
            const headerRowIndex = findHeaderRow(rawData)

            if (headerRowIndex !== -1) {
                // 提取表头和数据
                const headers = rawData[headerRowIndex].filter(header => header && header.trim() !== '')
                const dataRows = rawData.slice(headerRowIndex + 1)

                // 合并表头（去重，保持顺序）
                headers.forEach(h => {
                    if (!mergedHeaders.includes(h)) mergedHeaders.push(h)
                })

                // 合并数据行（过滤全空行）
                dataRows.forEach(row => {
                    // 判定是否全空：在当前 headers 下无任何非空单元格
                    const hasValue = headers.some((_, colIndex) => {
                        const v = row[colIndex]
                        return v != null && String(v).trim() !== ''
                    })
                    if (!hasValue) return

                    const data: Record<string, any> = {}
                    headers.forEach((header, colIndex) => {
                        data[header] = row[colIndex] ?? ''
                    })
                    mergedRows.push({
                        data,
                        colorCategory: COLORS.DEFAULT,
                        index: globalIndex++,
                        hasCleaned: false
                    })
                })
            }
        })

        // 重排表头：将关键列提前
        const preferred = [
            COLUMN_NAMES.PART_NUMBER,
            COLUMN_NAMES.SUPPLIER_PART_NUMBER,
            COLUMN_NAMES.TYPE,
            COLUMN_NAMES.QUANTITY,
        ]
        const orderedHeaders = reorderHeaders(mergedHeaders, preferred)

        const mergedTable: TableData = {
            headers: orderedHeaders,
            rows: mergedRows,
            metadata: {
                rowCount: mergedRows.length,
                columnCount: orderedHeaders.length,
                importTime: new Date()
            }
        }

        // 返回BOMFile格式（original/cleaned 都为单一 TableData）
        return {
            name: fileName,
            rows: mergedRows.length,
            status: 'success',
            errorMsg: '',
            original: mergedTable,
            cleaned: mergedTable // 目前未做清洗，先保持一致
        }

    } catch (error) {
        const emptyTable: TableData = {
            headers: [],
            rows: [],
            metadata: { rowCount: 0, columnCount: 0, importTime: new Date() }
        }
        return {
            name: fileName,
            rows: 0,
            status: 'error',
            errorMsg: error instanceof Error ? error.message : String(error),
            original: emptyTable,
            cleaned: emptyTable
        }
    }
}

/**
 * 使用ExcelJS解析 XLSX 文件
 * @param xlsxData XLSX 二进制数据（Buffer/Uint8Array/ArrayBuffer）
 * @param fileName 文件名
 */
export async function parseXLSXWithExcelJS(
    xlsxData: ArrayBuffer | Uint8Array | any,
    fileName: string
): Promise<BOMFile> {
    try {
        // 动态导入，避免在纯浏览器环境打包 ExcelJS
        const ExcelJS = (await import('exceljs')).default as any

        const workbook = new ExcelJS.Workbook()

        // 兼容多种二进制输入（避免直接引用 Node Buffer 类型）
        const NodeBuffer: any = (globalThis as any).Buffer
        if (NodeBuffer && typeof NodeBuffer.isBuffer === 'function' && NodeBuffer.isBuffer(xlsxData)) {
            await workbook.xlsx.load(xlsxData as any)
        } else if (xlsxData instanceof Uint8Array) {
            await workbook.xlsx.load(xlsxData)
        } else if (xlsxData instanceof ArrayBuffer) {
            await workbook.xlsx.load(new Uint8Array(xlsxData))
        } else {
            throw new Error('不支持的 XLSX 数据类型')
        }

        const mergedHeaders: string[] = []
        const mergedRows: TableRow[] = []
        let globalIndex = 0

        workbook.worksheets.forEach((ws: any) => {
            // 将工作表转成二维数组（从1开始的数组，索引0为空）
            const values: any[] = ws.getSheetValues?.() || []
            // 规范化为 string[][]，去掉索引0
            const rawData: string[][] = values
                .slice(1)
                .map((row: any) => {
                    if (!row) return []
                    // row 也是从1开始的数组
                    return row
                        .slice(1)
                        .map((cell: any) => normalizeCellValue(cell)) as string[]
                })

            const headerRowIndex = findHeaderRow(rawData)
            if (headerRowIndex === -1) return

            const headers = rawData[headerRowIndex].filter(h => h && h.trim() !== '')
            const dataRows = rawData.slice(headerRowIndex + 1)

            // 合并表头（去重，保持顺序）
            headers.forEach(h => { if (!mergedHeaders.includes(h)) mergedHeaders.push(h) })

            // 合并数据行（过滤全空行）
            dataRows.forEach(row => {
                const hasValue = headers.some((_, colIndex) => {
                    const v = row[colIndex]
                    return v != null && String(v).trim() !== ''
                })
                if (!hasValue) return

                const data: Record<string, any> = {}
                headers.forEach((header, colIndex) => {
                    data[header] = row[colIndex] ?? ''
                })
                mergedRows.push({
                    data,
                    colorCategory: COLORS.DEFAULT,
                    index: globalIndex++,
                    hasCleaned: false
                })
            })
        })

        // 简单清洗：删除首列为“Design”或等于首个表头名的行
        const firstColKey = mergedHeaders.find(h => h && h.trim() !== '') || ''
        if (firstColKey) {
            const cleaned = mergedRows.filter(r => {
                const v = (r.data?.[firstColKey] ?? '').toString().trim()
                return v !== 'Design' && v !== firstColKey
            })
            if (cleaned.length !== mergedRows.length) {
                mergedRows.length = 0
                mergedRows.push(...cleaned)
            }
        }

        // 重排表头：将关键列提前
        const preferred = [
            COLUMN_NAMES.PART_NUMBER,
            COLUMN_NAMES.SUPPLIER_PART_NUMBER,
            COLUMN_NAMES.TYPE,
            COLUMN_NAMES.QUANTITY,
        ]
        const orderedHeaders = reorderHeaders(mergedHeaders, preferred)

        const mergedTable: TableData = {
            headers: orderedHeaders,
            rows: mergedRows,
            metadata: {
                rowCount: mergedRows.length,
                columnCount: orderedHeaders.length,
                importTime: new Date()
            }
        }

        return {
            name: fileName,
            rows: mergedRows.length,
            status: 'success',
            errorMsg: '',
            original: mergedTable,
            cleaned: mergedTable
        }
    } catch (error) {
        const emptyTable: TableData = {
            headers: [],
            rows: [],
            metadata: { rowCount: 0, columnCount: 0, importTime: new Date() }
        }
        return {
            name: fileName,
            rows: 0,
            status: 'error',
            errorMsg: error instanceof Error ? error.message : String(error),
            original: emptyTable,
            cleaned: emptyTable
        }
    }
}

// 规范化 ExcelJS 单元格为字符串
function normalizeCellValue(cell: any): string {
    if (cell == null) return ''
    if (typeof cell === 'string') return cell
    if (typeof cell === 'number') return String(cell)
    if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE'
    // 按需求：ExcelJS 的对象值（富文本/日期/公式等）统一丢弃为空，由后续清洗流程决定
    if (cell && typeof cell === 'object') return ''
    try { return String(cell) } catch { return '' }
}

/**
 * 查找表头行
 * 从上到下查找第一个包含"零件号"、"供应商零件号"或"客户零件号"的行
 * @param rawData 二维数组格式的原始数据
 * @returns 表头行的索引，未找到返回-1
 */
function findHeaderRow(rawData: string[][]): number {
    const headerKeywords = ['零件号', '供应商零件号', '客户零件号']

    for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
        const row = rawData[rowIndex]
        if (!row || row.length === 0) continue

        // 检查第一个单元格是否包含关键词
        const firstCell = row[0]?.toString().trim() || ''

        if (headerKeywords.some(keyword => firstCell.includes(keyword))) {
            return rowIndex
        }
    }

    return -1 // 未找到表头行
}

/**
 * 重排表头：将 preferred 中存在的列提前，其他列保持原有顺序
 */
function reorderHeaders(headers: string[], preferred: string[]): string[] {
    const headerSet = new Set(headers)
    const front = preferred.filter(h => headerSet.has(h))
    const rest = headers.filter(h => !front.includes(h))
    return [...front, ...rest]
}

/**
 * 统一入口：根据文件扩展名自动选择解析器
 * 支持的数据：string | ArrayBuffer | Uint8Array | Blob | Node Buffer
 * 返回：标准 BOMFile
 */
export async function parseBOMAuto(
    data: string | ArrayBuffer | Uint8Array | Blob | any,
    fileName: string
): Promise<BOMFile> {
    const ext = (fileName.split('.').pop() || '').toLowerCase()
    switch (ext) {
        case 'html':
        case 'htm': {
            const text = await ensureText(data)
            return await parseHTMLWithSheetJS(text, fileName)
        }
        case 'xlsx': {
            const bin = await ensureBinary(data)
            return await parseXLSXWithExcelJS(bin, fileName)
        }
        case 'xls': {
            const bin = await ensureBinary(data)
            return await parseXLSWithSheetJS(bin, fileName)
        }
        case 'csv': {
            const text = await ensureText(data)
            return await parseCSVWithExcelJS(text, fileName)
        }
        default: {
            // 简单探测：HTML/CSV
            if (typeof data === 'string') {
                const trimmed = data.trim().slice(0, 200).toLowerCase()
                if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.includes('<table')) {
                    return await parseHTMLWithSheetJS(data, fileName)
                }
                // 作为 CSV 尝试
                return await parseCSVWithExcelJS(data, fileName)
            }
            // 二进制优先尝试 XLSX，再尝试 XLS
            const bin = await ensureBinary(data)
            try { return await parseXLSXWithExcelJS(bin, fileName) } catch {
                try { return await parseXLSWithSheetJS(bin, fileName) } catch (e) {
                    const emptyTable: TableData = { headers: [], rows: [], metadata: { rowCount: 0, columnCount: 0, importTime: new Date() } }
                    return { name: fileName, rows: 0, status: 'error', errorMsg: e instanceof Error ? e.message : String(e), original: emptyTable, cleaned: emptyTable }
                }
            }
        }
    }
}

// 将输入规范化为 UTF-8 文本
async function ensureText(input: string | ArrayBuffer | Uint8Array | Blob | any): Promise<string> {
    if (typeof input === 'string') return input
    const NodeBuffer: any = (globalThis as any).Buffer
    if (NodeBuffer && typeof NodeBuffer.isBuffer === 'function' && NodeBuffer.isBuffer(input)) {
        return input.toString('utf8')
    }
    if (typeof Blob !== 'undefined' && input instanceof Blob) {
        return await (input as Blob).text()
    }
    if (input instanceof Uint8Array) {
        return new TextDecoder('utf-8').decode(input)
    }
    if (input instanceof ArrayBuffer) {
        return new TextDecoder('utf-8').decode(new Uint8Array(input))
    }
    return String(input ?? '')
}

// 将输入规范化为二进制（Uint8Array）
async function ensureBinary(input: string | ArrayBuffer | Uint8Array | Blob | any): Promise<Uint8Array | any> {
    const NodeBuffer: any = (globalThis as any).Buffer
    if (NodeBuffer && typeof NodeBuffer.isBuffer === 'function' && NodeBuffer.isBuffer(input)) {
        return input
    }
    if (typeof Blob !== 'undefined' && input instanceof Blob) {
        const ab = await (input as Blob).arrayBuffer()
        return new Uint8Array(ab)
    }
    if (input instanceof Uint8Array) return input
    if (input instanceof ArrayBuffer) return new Uint8Array(input)
    if (typeof input === 'string') {
        // 将字符串按 UTF-8 编码为二进制（用于 CSV/XLS 作为兜底）
        return new TextEncoder().encode(input)
    }
    // 兜底返回
    try { return new Uint8Array(input) } catch { return new Uint8Array() }
}

/**
 * 使用SheetJS解析 XLS（二进制 Excel）文件
 * 行为与 parseHTMLWithSheetJS 一致：合并所有命中表头的表为单一 TableData
 */
export async function parseXLSWithSheetJS(
    xlsData: ArrayBuffer | Uint8Array | any | string,
    fileName: string
): Promise<BOMFile> {
    try {
        // 选择合适的 SheetJS 读取类型
        const NodeBuffer: any = (globalThis as any).Buffer
        let workbook: XLSX.WorkBook
        if (NodeBuffer && typeof NodeBuffer.isBuffer === 'function' && NodeBuffer.isBuffer(xlsData)) {
            workbook = XLSX.read(xlsData, { type: 'buffer' })
        } else if (xlsData instanceof ArrayBuffer) {
            workbook = XLSX.read(xlsData, { type: 'array' })
        } else if (xlsData instanceof Uint8Array) {
            workbook = XLSX.read(xlsData, { type: 'array' })
        } else if (typeof xlsData === 'string') {
            // 作为二进制字符串读取（确保传入的是二进制编码的字符串）
            workbook = XLSX.read(xlsData, { type: 'binary' })
        } else {
            throw new Error('不支持的 XLS 数据类型')
        }

        const mergedHeaders: string[] = []
        const mergedRows: TableRow[] = []
        let globalIndex = 0

        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName]
            const rawData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                raw: false,
                defval: ''
            }) as string[][]

            const headerRowIndex = findHeaderRow(rawData)
            if (headerRowIndex === -1) return

            const headers = rawData[headerRowIndex].filter(h => h && h.trim() !== '')
            const dataRows = rawData.slice(headerRowIndex + 1)

            headers.forEach(h => { if (!mergedHeaders.includes(h)) mergedHeaders.push(h) })

            dataRows.forEach(row => {
                const hasValue = headers.some((_, colIndex) => {
                    const v = row[colIndex]
                    return v != null && String(v).trim() !== ''
                })
                if (!hasValue) return

                const data: Record<string, any> = {}
                headers.forEach((header, colIndex) => { data[header] = row[colIndex] ?? '' })
                mergedRows.push({ data, colorCategory: COLORS.DEFAULT, index: globalIndex++, hasCleaned: false })
            })
        })

        // 简单清洗：删除首列为“Design”或等于首个表头名的行
        const firstColKeyXls = mergedHeaders.find(h => h && h.trim() !== '') || ''
        if (firstColKeyXls) {
            const cleaned = mergedRows.filter(r => {
                const v = (r.data?.[firstColKeyXls] ?? '').toString().trim()
                return v !== 'Design' && v !== firstColKeyXls
            })
            if (cleaned.length !== mergedRows.length) {
                mergedRows.length = 0
                mergedRows.push(...cleaned)
            }
        }

        // 重排表头：将关键列提前
        const preferred = [
            COLUMN_NAMES.PART_NUMBER,
            COLUMN_NAMES.SUPPLIER_PART_NUMBER,
            COLUMN_NAMES.TYPE,
            COLUMN_NAMES.QUANTITY,
        ]
        const orderedHeaders = reorderHeaders(mergedHeaders, preferred)

        const mergedTable: TableData = {
            headers: orderedHeaders,
            rows: mergedRows,
            metadata: { rowCount: mergedRows.length, columnCount: orderedHeaders.length, importTime: new Date() }
        }

        return { name: fileName, rows: mergedRows.length, status: 'success', errorMsg: '', original: mergedTable, cleaned: mergedTable }
    } catch (error) {
        const emptyTable: TableData = { headers: [], rows: [], metadata: { rowCount: 0, columnCount: 0, importTime: new Date() } }
        return { name: fileName, rows: 0, status: 'error', errorMsg: error instanceof Error ? error.message : String(error), original: emptyTable, cleaned: emptyTable }
    }
}

/**
 * 使用ExcelJS解析 CSV 文件
 * - 将输入规范为 UTF-8 文本
 * - 使用 workbook.csv.read 读取为单工作表
 * - 自动找表头并合并为单个 TableData
 */
export async function parseCSVWithExcelJS(
    csvData: ArrayBuffer | Uint8Array | any | string,
    fileName: string
): Promise<BOMFile> {
    try {
        const ExcelJS = (await import('exceljs')).default as any
        const workbook = new ExcelJS.Workbook()

        const NodeBuffer: any = (globalThis as any).Buffer
        let text: string
        if (typeof csvData === 'string') {
            text = csvData
        } else if (NodeBuffer && typeof NodeBuffer.isBuffer === 'function' && NodeBuffer.isBuffer(csvData)) {
            text = csvData.toString('utf8')
        } else if (csvData instanceof Uint8Array) {
            text = new TextDecoder('utf-8').decode(csvData)
        } else if (csvData instanceof ArrayBuffer) {
            text = new TextDecoder('utf-8').decode(new Uint8Array(csvData))
        } else {
            text = String(csvData ?? '')
        }

        // 读取 CSV 文本到工作簿（ExcelJS 支持从字符串读取）
        await workbook.csv.read(text)

        const mergedHeaders: string[] = []
        const mergedRows: TableRow[] = []
        let globalIndex = 0

        workbook.worksheets.forEach((ws: any) => {
            const values: any[] = ws.getSheetValues?.() || []
            const rawData: string[][] = values
                .slice(1)
                .map((row: any) => (row ? row.slice(1).map((cell: any) => normalizeCellValue(cell)) : []))

            const headerRowIndex = findHeaderRow(rawData)
            if (headerRowIndex === -1) return

            const headers = rawData[headerRowIndex].filter(h => h && h.trim() !== '')
            const dataRows = rawData.slice(headerRowIndex + 1)

            headers.forEach(h => { if (!mergedHeaders.includes(h)) mergedHeaders.push(h) })

            dataRows.forEach(row => {
                const hasValue = headers.some((_, colIndex) => {
                    const v = row[colIndex]
                    return v != null && String(v).trim() !== ''
                })
                if (!hasValue) return

                const data: Record<string, any> = {}
                headers.forEach((header, colIndex) => { data[header] = row[colIndex] ?? '' })
                mergedRows.push({ data, colorCategory: COLORS.DEFAULT, index: globalIndex++, hasCleaned: false })
            })
        })

        // 简单清洗：删除首列为“Design”或等于首个表头名的行
        const firstColKeyCsv = mergedHeaders.find(h => h && h.trim() !== '') || ''
        if (firstColKeyCsv) {
            const cleaned = mergedRows.filter(r => {
                const v = (r.data?.[firstColKeyCsv] ?? '').toString().trim()
                return v !== 'Design' && v !== firstColKeyCsv
            })
            if (cleaned.length !== mergedRows.length) {
                mergedRows.length = 0
                mergedRows.push(...cleaned)
            }
        }

        // 重排表头：将关键列提前
        const preferred = [
            COLUMN_NAMES.PART_NUMBER,
            COLUMN_NAMES.SUPPLIER_PART_NUMBER,
            COLUMN_NAMES.TYPE,
            COLUMN_NAMES.QUANTITY,
        ]
        const orderedHeaders = reorderHeaders(mergedHeaders, preferred)

        const mergedTable: TableData = {
            headers: orderedHeaders,
            rows: mergedRows,
            metadata: { rowCount: mergedRows.length, columnCount: orderedHeaders.length, importTime: new Date() }
        }

        return { name: fileName, rows: mergedRows.length, status: 'success', errorMsg: '', original: mergedTable, cleaned: mergedTable }
    } catch (error) {
        const emptyTable: TableData = { headers: [], rows: [], metadata: { rowCount: 0, columnCount: 0, importTime: new Date() } }
        return { name: fileName, rows: 0, status: 'error', errorMsg: error instanceof Error ? error.message : String(error), original: emptyTable, cleaned: emptyTable }
    }
}

