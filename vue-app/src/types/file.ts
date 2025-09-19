/**
 * 文件管理相关的类型定义
 * 提供 BOM 文件在解析/清洗/对比阶段所需的核心数据结构。
 */

import { TableData } from './table'

/**
 * 文件状态
 * - 'pending'：待处理或解析中
 * - 'success'：处理成功
 * - 'error'：处理失败
 */
export type FileStatus = 'pending' | 'success' | 'error'

/**
 * BOM 文件对象
 * 描述单个导入文件的整体信息，以及原始/清洗后的表格数据。
 */
export interface BOMFile {
    /** 文件名（不包含路径） */
    name: string
    /** 当前文件的行数（通常为 cleaned.rows.length） */
    rows: number
    /** 文件处理状态 */
    status: FileStatus
    /** 错误信息（当 status 为 'error' 时有效） */
    errorMsg: string

    /** 解析得到的原始表数据（不应被修改，仅标记 hasCleaned） */
    original: TableData
    /** 清洗后的表数据（供后续对比与导出使用） */
    cleaned: TableData
}

/**
 * 对比统计信息
 * 用于展示对比结果的数量分布。
 */
export interface ComparisonStats {
    /** 未在对表中找到的数量（红色） */
    red: number
    /** 未找到但供应商零件号可匹配的数量（橙色） */
    orange: number
    /** 找到但数量不同的数量（蓝色） */
    blue: number
    /** 完全匹配的数量（绿色） */
    green: number
    /** 总数量 */
    total: number
}

/**
 * 导线差异信息
 * 表示单个零件号在两表对比中的数量差异。
 */
export interface WireDifference {
    /** 零件号（PN） */
    partNumber: string
    /** 类型（例如：WIRE/线束/导线） */
    type: string
    /** 数量差异（正负均可能） */
    difference: number
}


