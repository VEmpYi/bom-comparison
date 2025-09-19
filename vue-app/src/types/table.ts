import { COLORS } from '../constants'
/**
 * 表格数据相关的类型定义
 * 定义统一的表格抽象：表头、行数据与元信息，供解析/清洗/对比/导出模块复用。
 */

/**
 * 完整表格数据结构
 * - headers：顺序即为列顺序；
 * - rows：每行以列名为键存储数据；
 * - metadata：记录行列数量与导入时间。
 */
export interface TableData {
    /** 表头列名数组（顺序即列顺序） */
    headers: string[]
    /** 表格元数据（行列统计等） */
    metadata: TableMetadata
    /** 行数据数组（与 headers 对应） */
    rows: TableRow[]
}

// 统一使用 COLORS（ARGB 字符串枚举）作为颜色类型
export type RowColorCategory = COLORS

/**
 * 表格元数据
 * 用于展示统计信息以及记录导入时间。
 */
export interface TableMetadata {
    /** 总行数（等于 rows.length） */
    rowCount: number
    /** 总列数（等于 headers.length） */
    columnCount: number
    /** 导入时间（可选） */
    importTime?: Date
}

/**
 * 表格行数据
 * - data：键为列名、值为单元格内容；
 * - colorCategory：行的 UI 标记；
 * - index：原始解析时的行号（清洗后会重排）；
 * - hasCleaned：仅在 original 中使用，标记该原始行是否已被清洗逻辑“删除/合并”。
 */
export interface TableRow {
    /** 行数据，键为列名，值为单元格内容 */
    data: Record<string, any>
    /** 行颜色分类（用于背景色，ARGB 枚举） */
    colorCategory: COLORS
    /**  */
    index: number
    /** 是否在清洗过程中被删除/合并（仅标记在 original 上） */
    hasCleaned?: boolean
}


// // 表格缓存结构
// export interface TableCache {
//     [fileName: string]: TableData
// }

// // 筛选状态
// export interface FilterState {
//     search: string           // 搜索关键词
//     selectedValues: Set<string> // 选中的值
//     open: boolean           // 是否打开筛选面板
// }

// // 筛选UI状态
// export interface FilterUIState {
//     [filterKey: string]: FilterState // filterKey格式：fileName__columnName
// }
