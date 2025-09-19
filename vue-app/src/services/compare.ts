import type { BOMFile } from '../types/file'
import { type TableRow } from '../types/table'
import { COLORS, COLUMN_NAMES, WIRE_TYPES } from '../constants'

/**
 * 对比两个 BOMFile（异步、纯函数）：不修改传入对象，返回带上色后的副本
 * 颜色分配规则：
 *  1) PN 在对侧未找到 -> RED
 *  2) PN 在对侧找到，数量相同 -> GREEN
 *  3) PN 在对侧找到，数量不同 -> BLUE
 *  4) 在双方 RED 集合中，供应商 PN 相互命中 -> ORANGE
 *
 * 性能：构建 PN -> 行 的索引（O(n)），两侧各一次线性扫描（O(n)），
 * 再收集 RED 的供应商 PN 做一次集合命中（O(n)）。整体近似 O(n)。
 *
 * @param left  左侧 BOM 文件（通常使用 cleaned 表）
 * @param right 右侧 BOM 文件（通常使用 cleaned 表）
 * @returns 带有颜色标记的两个 BOMFile 副本
 */
export async function compareBOMFiles(left: BOMFile, right: BOMFile): Promise<{ left: BOMFile; right: BOMFile }> {
  // 复制副本（浅拷贝 + 行级深拷贝 data 以避免共享）
  const copyFile = (src: BOMFile): BOMFile => ({
    ...src,
    original: {
      headers: [...src.original.headers],
      metadata: { ...src.original.metadata },
      rows: src.original.rows.map(cloneRow)
    },
    cleaned: {
      headers: [...src.cleaned.headers],
      metadata: { ...src.cleaned.metadata },
      rows: src.cleaned.rows.map(cloneRow)
    }
  })

  const L = copyFile(left)
  const R = copyFile(right)

  const leftRows = L.cleaned.rows
  const rightRows = R.cleaned.rows

  // 构建 PN -> 行 的索引，便于 O(1) 查找
  const leftByPN = new Map<string, TableRow>()
  const rightByPN = new Map<string, TableRow>()

  for (const r of leftRows) {
    const pn = String(r.data[COLUMN_NAMES.PART_NUMBER] ?? '').trim()
    if (pn) leftByPN.set(pn, r)
  }
  for (const r of rightRows) {
    const pn = String(r.data[COLUMN_NAMES.PART_NUMBER] ?? '').trim()
    if (pn) rightByPN.set(pn, r)
  }

  // 第一轮：按 PN 比对，赋 RED/GREEN/BLUE（找不到=RED；找到且数量相等=GREEN；否则=BLUE）
  for (const r of leftRows) {
    applyPNCompareColor(r, rightByPN)
  }
  for (const r of rightRows) {
    applyPNCompareColor(r, leftByPN)
  }

  // 收集 RED 集合中的供应商 PN（用于第二轮 ORANGE 判定）
  const leftRedSPNs = new Set<string>()
  const rightRedSPNs = new Set<string>()
  collectRedSupplierSet(leftRows, leftRedSPNs)
  collectRedSupplierSet(rightRows, rightRedSPNs)

  // 第二轮：若仍为 RED 且供应商 PN 在对侧 RED SPN 集合中 -> ORANGE
  for (const r of leftRows) {
    if (r.colorCategory === COLORS.LIGHT_RED) {
      const spn = String(r.data[COLUMN_NAMES.SUPPLIER_PART_NUMBER] ?? '').trim()
      if (spn && rightRedSPNs.has(spn)) r.colorCategory = COLORS.ORANGE
    }
  }
  for (const r of rightRows) {
    if (r.colorCategory === COLORS.LIGHT_RED) {
      const spn = String(r.data[COLUMN_NAMES.SUPPLIER_PART_NUMBER] ?? '').trim()
      if (spn && leftRedSPNs.has(spn)) r.colorCategory = COLORS.ORANGE
    }
  }

  return { left: L, right: R }
}

function cloneRow(r: TableRow): TableRow {
  const data: Record<string, any> = {}
  for (const k in r.data) data[k] = r.data[k]
  return { ...r, data } // colorCategory 会被覆盖为结果色
}

/**
 * 安全数值转换：接受 number/字符串，去除空白和逗号后转 number，失败返回 0。
 */
function toNumberSafe(v: any): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (v == null) return 0
  const s = String(v).replace(/[\s,]/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/**
 * 应用 PN 对比颜色：在 otherByPN 查找同 PN；不存在->RED；存在且数量相等->GREEN；否则->BLUE。
 */
function applyPNCompareColor(row: TableRow, otherByPN: Map<string, TableRow>) {
  const pn = String(row.data[COLUMN_NAMES.PART_NUMBER] ?? '').trim()
  const other = pn ? otherByPN.get(pn) : undefined
  if (!other) {
    row.colorCategory = COLORS.LIGHT_RED
    return
  }
  const q1 = toNumberSafe(row.data[COLUMN_NAMES.QUANTITY])
  const q2 = toNumberSafe(other.data[COLUMN_NAMES.QUANTITY])
  row.colorCategory = (q1 === q2) ? COLORS.LIGHT_GREEN : COLORS.LIGHT_BLUE
}

/**
 * 从行集合中收集当前为 RED 的供应商 PN 集合。
 */
function collectRedSupplierSet(rows: TableRow[], out: Set<string>) {
  for (const r of rows) {
    if (r.colorCategory === COLORS.LIGHT_RED) {
      const spn = String(r.data[COLUMN_NAMES.SUPPLIER_PART_NUMBER] ?? '').trim()
      if (spn) out.add(spn)
    }
  }
}

/**
 * 对导线类型进行对比
 * 输入：两个 BOMFile
 * 输出：
 *   - left:  左表导线行清单，每项：{ 零件号, 类型, 本表数量, 对表数量 }
 *   - right: 右表导线行清单，每项：{ 零件号, 类型, 本表数量, 对表数量 }
 * 规则：
 *   - 仅筛选 cleaned.rows 中列名为 “类型” 或 “TYPE” 且值为 {WIRE, 线束, 导线} 的行
 *   - 左清单：以左表导线行为基准，右表数量按同 PN 查找（无则 0）
 *   - 右清单：以右表导线行为基准，左表数量按同 PN 查找（无则 0）
 */
/**
 * 对导线类型进行对比，分别输出左/右两表的导线清单（本表数量/对表数量）。
 *
 * 过滤条件：列名为 “类型”/“TYPE”，值在常量 WIRE_TYPES（WIRE/线束/导线）内。
 * 聚合：同一零件号在同表内数量求和。
 * 排序：按零件号做自然排序（数字感知）。
 *
 * @param left 左侧 BOMFile（读取 cleaned.rows）
 * @param right 右侧 BOMFile（读取 cleaned.rows）
 * @returns { left, right } 两个数组，元素为 { 零件号, 类型, 本表数量, 对表数量 }
 */
export async function compareWires(left: BOMFile, right: BOMFile): Promise<{
  left: Array<{ '零件号': string; '类型': string; '本表数量': number; '对表数量': number }>
  right: Array<{ '零件号': string; '类型': string; '本表数量': number; '对表数量': number }>
}> {
  const leftRows = left.cleaned.rows
  const rightRows = right.cleaned.rows

  const getTypeVal = (r: TableRow) => String((r.data[COLUMN_NAMES.TYPE] ?? r.data['TYPE'] ?? '')).trim()

  // 构建对侧 PN -> 数量 映射（不做聚合，假设清洗后唯一）
  const rightQtyByPN = new Map<string, number>()
  for (const r of rightRows) {
    const tp = getTypeVal(r)
    if (!WIRE_TYPES.has(tp)) continue
    const pn = String(r.data[COLUMN_NAMES.PART_NUMBER] ?? '').trim()
    if (!pn) continue
    rightQtyByPN.set(pn, toNumberSafe(r.data[COLUMN_NAMES.QUANTITY]))
  }

  const leftQtyByPN = new Map<string, number>()
  for (const r of leftRows) {
    const tp = getTypeVal(r)
    if (!WIRE_TYPES.has(tp)) continue
    const pn = String(r.data[COLUMN_NAMES.PART_NUMBER] ?? '').trim()
    if (!pn) continue
    leftQtyByPN.set(pn, toNumberSafe(r.data[COLUMN_NAMES.QUANTITY]))
  }

  // 左清单：逐行输出（不聚合）
  const leftList: Array<{ '零件号': string; '类型': string; '本表数量': number; '对表数量': number }> = []
  for (const r of leftRows) {
    const tp = getTypeVal(r)
    if (!WIRE_TYPES.has(tp)) continue
    const pn = String(r.data[COLUMN_NAMES.PART_NUMBER] ?? '').trim()
    if (!pn) continue
    const lqty = toNumberSafe(r.data[COLUMN_NAMES.QUANTITY])
    const rqty = rightQtyByPN.get(pn) ?? 0
    leftList.push({ '零件号': pn, '类型': tp, '本表数量': lqty, '对表数量': rqty })
  }

  // 右清单：逐行输出（不聚合）
  const rightList: Array<{ '零件号': string; '类型': string; '本表数量': number; '对表数量': number }> = []
  for (const r of rightRows) {
    const tp = getTypeVal(r)
    if (!WIRE_TYPES.has(tp)) continue
    const pn = String(r.data[COLUMN_NAMES.PART_NUMBER] ?? '').trim()
    if (!pn) continue
    const rqty = toNumberSafe(r.data[COLUMN_NAMES.QUANTITY])
    const lqty = leftQtyByPN.get(pn) ?? 0
    rightList.push({ '零件号': pn, '类型': tp, '本表数量': rqty, '对表数量': lqty })
  }

  // 按零件号进行自然排序（localeCompare，numeric: true）
  leftList.sort((a, b) => naturalCompare(a['零件号'], b['零件号']))
  rightList.sort((a, b) => naturalCompare(a['零件号'], b['零件号']))

  return { left: leftList, right: rightList }
}

/** 自然排序（数字感知） */
function naturalCompare(a: string, b: string): number {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

