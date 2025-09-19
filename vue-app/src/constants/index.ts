// 全局常量与列名、颜色定义
export const COLUMN_NAMES = {
    PART_NUMBER: '零件号',
    SUPPLIER_PART_NUMBER: '供应商零件号',
    CUSTOMER_PART_NUMBER: '客户零件号',
    QUANTITY: '数量',
    TYPE: '类型',
    PART_REVISION: '零件版本',
    SUPPLIER_NAME: '供应商名称',
    COLOR: '颜色',
    MATERIAL: '材料',
    UOM: '度量单位',
    COMPARE_TAG: '对比标记',    // 仅在导出带对比的文件时需要
} as const

export const HEADER_TOKENS = new Set(['零件号', '供应商零件号', '客户零件号'])

export const WIRE_TYPES = new Set(['WIRE', '线束', '导线'])

export enum COLORS {
    // 统一颜色源（ARGB 字符串）
    DEFAULT = '',
    LIGHT_RED = 'FFFEF2F2',   // red-50  #FEF2F2
    ORANGE = 'FFFFF7ED',      // orange-50 #FFF7ED
    LIGHT_BLUE = 'FFEFF6FF',  // blue-50 #EFF6FF
    LIGHT_GREEN = 'FFF0FDF4', // green-50 #F0FDF4
    PURPLE = 'FFF5F3FF',      // purple-50 #F5F3FF
    GRAY = 'FFF5F5F5',        // gray-100 更柔和
    LIGHT_GRAY = 'FFF9FAFB',  // gray-50 更浅
}

export const COLOR_TO_PRIORITY: Record<string, number> = { red: 0, orange: 1, blue: 2, green: 3 }
