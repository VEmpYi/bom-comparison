<template>
  <div class="container mx-auto px-2 py-6 max-w-none w-[95vw]">
    <main class="card-modern rounded-2xl p-8 gpu-accelerated" role="main">
      <header class="flex flex-col gap-4 mb-10 relative">
        <div class="flex items-end gap-4 flex-wrap">
          <h1 class="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
            <span class="p-3 bg-gradient-to-br from-green-400 to-blue-500 rounded-xl text-white shadow-lg">
              <i class="fa-solid fa-table" aria-hidden="true"></i>
            </span>
            BOM 对比分析工具
          </h1>
          <span class="text-lg text-gray-600 font-medium">{{ subtitle }}</span>
        </div>
        <p class="text-gray-700 leading-relaxed">
          🚀 BOM对比分析工具，支持导入多份数据，并可对最多两份数据进行即时对比。
          <strong class="text-amber-600">⚠️ 注意：导入的文件必须解密才可用。</strong>
        </p>
        <div class="absolute right-0 top-0 flex flex-col items-end gap-2" aria-live="polite">
          <transition name="fadeout">
            <div v-if="sheetBadge.show" :class="['text-sm font-medium text-white px-4 py-2 rounded-full shadow-lg', sheetBadge.bgClass]" role="status">
              {{ sheetBadge.text }}
            </div>
          </transition>
          <transition name="fadeout">
            <div v-if="sjsBadge && sjsBadge.show" :class="['text-sm font-medium text-white px-4 py-2 rounded-full shadow-lg', sjsBadge.bgClass]" role="status">
              {{ sjsBadge.text }}
            </div>
          </transition>
          <transition name="fadeout">
            <div v-if="faBadge.show" :class="['text-sm font-medium text-white px-4 py-2 rounded-full shadow-lg', faBadge.bgClass]" role="status">
              {{ faBadge.text }}
            </div>
          </transition>
        </div>
      </header>

      <section class="mb-8" aria-labelledby="file-import-heading">
        <h2 id="file-import-heading" class="block mb-4 text-lg font-bold text-gray-800 flex items-center gap-2">
          <i class="fa-solid fa-cloud-upload-alt text-blue-500" aria-hidden="true"></i>
          文件导入
        </h2>
        <div class="flex items-center gap-4 flex-wrap">
          <input ref="fileInputRef" id="fileInput" type="file" multiple accept=".xlsx,.xls,.html,.htm" @change="handleFiles" class="sr-only" aria-describedby="file-help" />
          <label for="fileInput" class="btn-modern px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 cursor-pointer font-semibold flex items-center gap-2 touch-friendly focus-visible" tabindex="0"
                 @keydown.enter="onOpenFileDialog" @keydown.space.prevent="onOpenFileDialog">
            <i class="fa-solid fa-folder-open" aria-hidden="true"></i>
            选择文件
          </label>
          <div class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-600">支持格式：Excel (.xlsx, .xls) 和 HTML (.html, .htm)</span>
            <span id="file-help" class="text-xs text-gray-500">💡 支持批量导入，可同时选择多个文件</span>
          </div>
          <div v-if="loading" class="flex items-center gap-3 px-6 py-3 bg-blue-50 rounded-xl border border-blue-200" role="status" aria-live="polite">
            <div class="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span class="text-blue-700 font-medium">正在解析文件，请稍候...</span>
          </div>
        </div>
      </section>

  <transition name="slide-down">
    <div v-if="filesOrder.length" class="mb-8 file-list-container p-4">
          <div class="font-semibold mb-2 text-gray-700 flex items-center gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <i class="fa-solid fa-list"></i>
      <span class="whitespace-nowrap">已导入文件（共 {{ filesOrder.length }} 个）：</span>
              <span class="truncate" :class="['text-sm', multiCompareMode ? 'text-red-600' : 'text-gray-500']">
                {{ multiCompareMode ? '勾选多份文件导出分别对比结果' : '勾选文件即可预览（最多并列2个）' }}
              </span>
            </div>
            <div class="flex-1"></div>
            <div class="ml-4 flex items-center gap-2">
              <button type="button" :class="multiCompareMode ? 'px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700' : 'px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700'" @click="toggleMultiCompare">
                {{ multiCompareMode ? '取消多选' : '多文件对比导出' }}
              </button>
              <button type="button" :class="['px-2 py-1 text-xs rounded border', multiCompareMode ? 'border-red-300 text-red-600 hover:bg-red-50' : 'invisible pointer-events-none border-transparent']" @click="selectAllFiles">
                全选
              </button>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <label v-for="(name, idx) in filesOrder" :key="name" class="file-item flex items-center gap-2 cursor-pointer bg-blue-50 hover:bg-blue-100 rounded px-2 py-1" :class="{ 'selected': selectedFiles.includes(name) }">
              <input type="checkbox" :checked="selectedFiles.includes(name)" @change="onFileCheckboxChange(name, ($event.target as HTMLInputElement).checked, (fileMeta[name]?.status || 'success'))" :disabled="fileMeta[name]?.status === 'error'" class="accent-blue-500" />
              <span class="truncate"><i class="fa-solid fa-file-excel text-green-500 mr-1"></i>{{ name }}</span>
              <span class="text-xs text-gray-400">({{ (fileMeta[name]?.rows ?? getTableDisplayData(name).data.length) }} 行)</span>
              <span class="ml-2">
                <i v-if="fileMeta[name]?.status === 'pending'" class="fa-solid fa-spinner fa-spin text-blue-400"></i>
                <i v-else-if="fileMeta[name]?.status === 'success' || !fileMeta[name]" class="fa-solid fa-check text-green-500"></i>
                <i v-else-if="fileMeta[name]?.status === 'error'" class="fa-solid fa-circle-exclamation text-red-500" title="解析失败"></i>
              </span>
              <span v-if="fileMeta[name]?.status === 'error'" class="text-xs text-red-500 ml-2">{{ fileMeta[name]?.errorMsg }}</span>
              <button type="button" @click.stop="removeFile(idx)" class="ml-2 px-2 py-1 text-xs text-red-500 hover:text-white hover:bg-red-500 rounded transition"><i class="fa-solid fa-trash"></i> 删除</button>
              <button type="button" @click.stop="showOriginal(name)" class="ml-2 px-2 py-1 text-xs text-gray-700 hover:text-white hover:bg-gray-600 rounded transition"><i class="fa-solid fa-table-list"></i> 原始数据</button>
            </label>
          </div>
          <div class="mt-2 text-xs" :class="multiCompareMode ? 'text-red-600' : 'text-gray-500'">
            {{ multiCompareMode ? '勾选多份文件导出分别对比结果' : '勾选文件进行预览（最多并列2个）' }}
          </div>
        </div>
      </transition>

      <div class="mb-4 flex items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-3 flex-wrap">
          <button type="button" @click="toggleCompare" :disabled="(selectedFiles.length !== 2 && !compareMode) || compareBusy"
                  class="px-3 py-1.5 rounded text-sm font-medium shadow transition flex items-center gap-2"
                  :class="compareBusy ? 'bg-gray-400 text-white cursor-wait' : (compareMode ? 'bg-red-600 text-white hover:bg-red-700' : (selectedFiles.length !== 2 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'))">
            <i v-if="compareBusy" class="fa-solid fa-spinner fa-spin"></i>
            <i v-else :class="compareMode ? 'fa-solid fa-toggle-on' : 'fa-solid fa-toggle-off'"></i>
            <span>{{ compareBusy ? '分析中...' : (compareMode ? '关闭对比' : '启动对比') }}</span>
          </button>
          <span v-if="selectedFiles.length !== 2" class="text-xs text-gray-400">需选择2个文件</span>
          <div class="flex items-center gap-3 text-xs text-gray-600">
            <span class="inline-flex items-center gap-2"><span class="w-3 h-3 inline-block rounded bg-red-600"></span>该行未在对表中找到</span>
            <span class="inline-flex items-center gap-2"><span class="w-3 h-3 inline-block rounded bg-orange-500"></span>该行虽未找到，但供应商零件号匹配</span>
            <span class="inline-flex items-center gap-2"><span class="w-3 h-3 inline-block rounded bg-blue-600"></span>该行在对表找到，但数量不同</span>
            <span class="inline-flex items-center gap-2"><span class="w-3 h-3 inline-block rounded bg-green-600"></span>该行与对表中数据一致</span>
          </div>
        </div>
        <div>
          <button type="button" @click="exportCompare" :class="['px-3 py-1.5 rounded text-sm font-medium shadow transition bg-emerald-600 text-white hover:bg-emerald-700', (selectedFiles.length > 0 && sheetReady) ? '' : 'invisible pointer-events-none']" :aria-hidden="!(selectedFiles.length > 0 && sheetReady)" :tabindex="(selectedFiles.length > 0 && sheetReady) ? 0 : -1" title="导出数据">
            <i class="fa-solid fa-file-arrow-down mr-1"></i>
            导出数据
          </button>
        </div>
      </div>

      <transition name="slide-up" @before-enter="onBeforeEnter" @enter="onEnter" @after-enter="onAfterEnter" @before-leave="onBeforeLeave" @leave="onLeave" @after-leave="onPreviewContainerAfterLeave">
        <div v-if="containerVisible" ref="previewWrap" class="w-full">
          <div class="w-full preview-container">
            <transition-group name="preview-list" tag="div" class="flex w-full flex-wrap gap-6 relative">
              <div v-for="(fileName, idx) in visibleSelectedFiles" :key="fileName" class="preview-card p-4" :style="cardStyle(idx, fileName)">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-semibold text-blue-600"><i class="fa-solid fa-file-excel text-green-500 mr-1"></i>{{ fileName }}</span>
                    <div class="flex items-center gap-2">
                      <div v-if="compareMode" class="flex items-center gap-1">
                        <label class="text-xs text-gray-500 mr-2">点击右侧色块筛选</label>
                        <button type="button" :class="badgeClass(fileName, 'red')" title="点击筛选仅在对表中未找到的行" @click.stop="toggleColorFilter(fileName, 'red')">{{ categoryCounts(fileName).red }}</button>
                        <button type="button" :class="badgeClass(fileName, 'orange')" title="点击筛选未找到但仅在对表中供应商零件号匹配的行" @click.stop="toggleColorFilter(fileName, 'orange')">{{ categoryCounts(fileName).orange }}</button>
                        <button type="button" :class="badgeClass(fileName, 'blue')" title="点击筛选仅在对表中数量不同的行" @click.stop="toggleColorFilter(fileName, 'blue')">{{ categoryCounts(fileName).blue }}</button>
                        <button type="button" :class="badgeClass(fileName, 'green')" title="点击筛选仅在对表中数量相同的行" @click.stop="toggleColorFilter(fileName, 'green')">{{ categoryCounts(fileName).green }}</button>
                      </div>
                      <span v-if="hasActiveFilters(fileName)" class="text-xs text-blue-600">筛选后 {{ filteredRows(fileName).length }} 行</span>
                      <span class="text-xs text-gray-700">共 {{ getTableDisplayData(fileName).data.length }} 行</span>
                    </div>
                  </div>
                  <div class="overflow-auto table-container">
                    <table class="min-w-full text-sm border border-gray-200 rounded-lg">
                      <thead>
                        <tr class="bg-blue-50">
                          <th v-for="col in getTableDisplayData(fileName).columns" :key="col" class="px-2 py-1 font-medium text-gray-700 border-b relative">
                            <div class="flex items-center gap-2">
                              <span class="truncate" :title="col">{{ col }}</span>
                              <button type="button" class="text-gray-500 hover:text-blue-600 filter-btn" :data-filter-key="fileName + '__' + col" @click.stop="toggleFilterDropdown(fileName, col, $event)" :title="isColumnFiltered(fileName, col) ? '已筛选' : '筛选'">
                                <i class="fa-solid fa-filter"></i>
                                <span v-if="isColumnFiltered(fileName, col)" class="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 ml-1"></span>
                              </button>
                            </div>
                            <teleport to="body">
                              <div v-if="isDropdownOpen(fileName, col)" class="filter-dropdown filter-panel fixed z-[10000] bg-white border rounded shadow-lg w-64 p-2" :style="dropdownStyle(fileName, col)">
                                <div class="mb-2">
                                  <input type="text" class="w-full border rounded px-2 py-1 text-xs" placeholder="搜索..." v-model="getFilterState(fileName, col).search">
                                </div>
                                <div class="flex items-center gap-2 mb-2">
                                  <button type="button" class="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded" @click.stop="selectAllValues(fileName, col)">全选</button>
                                  <button type="button" class="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded" @click.stop="clearAllValues(fileName, col)">清空</button>
                                </div>
                                <div class="max-h-56 overflow-auto border rounded p-1 text-sm">
                                  <label v-for="val in filteredDistinctValues(fileName, col)" :key="val" class="flex items-center gap-2 px-1 py-0.5 hover:bg-gray-50 cursor-pointer">
                                    <input type="checkbox" :checked="isValueChecked(fileName, col, val)" @change="onToggleValue(fileName, col, val, ($event.target as HTMLInputElement).checked)">
                                    <span class="truncate" :title="val || '(空)'">{{ val || '(空)' }}</span>
                                  </label>
                                </div>
                                <div class="flex justify-end gap-2 mt-2">
                                  <button class="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded" @click.stop="closeDropdown(fileName, col)">取消</button>
                                  <button class="text-xs px-2 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded" @click.stop="applyFilter(fileName, col)">确定</button>
                                </div>
                              </div>
                            </teleport>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(row, rIdx) in filteredRows(fileName)" :key="rIdx" :class="['transition hover:bg-blue-100', compareMode ? rowBgClass(fileName, row) : '', row && row._strikethrough ? 'line-through' : '']" :style="rowBgStyle(fileName, row)">
                          <td v-for="col in getTableDisplayData(fileName).columns" :key="col" class="px-2 py-1 border-b">
                            {{ (row && typeof row === 'object' && col in row) ? row[col] : '' }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div v-if="compareMode" class="mt-3 border-t pt-2">
                    <div class="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                      <i class="fa-solid fa-code-compare text-blue-500"></i>导线数量差值
                    </div>
                    <div v-if="wiresDiff(fileName).length === 0" class="text-xs text-gray-400">无差异或无导线类型</div>
                    <div v-else class="overflow-auto">
                      <table class="min-w-full text-xs border border-gray-200 rounded">
                        <thead>
                          <tr class="bg-gray-50">
                            <th class="px-2 py-1 border-b text-left">零件号</th>
                            <th class="px-2 py-1 border-b text-left">类型</th>
                            <th class="px-2 py-1 border-b text-right">本表数量</th>
                            <th class="px-2 py-1 border-b text-right">对表数量</th>
                            <th class="px-2 py-1 border-b text-right">差值(本-对)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(d, i) in wiresDiff(fileName)" :key="i">
                            <td class="px-2 py-1 border-b">{{ d.pn }}</td>
                            <td class="px-2 py-1 border-b">{{ d.type }}</td>
                            <td class="px-2 py-1 border-b text-right">{{ d.q1 }}</td>
                            <td class="px-2 py-1 border-b text-right">{{ d.q2 }}</td>
                            <td class="px-2 py-1 border-b text-right" :class="d.diff === 0 ? 'text-gray-500' : (d.diff > 0 ? 'text-green-600' : 'text-red-600')">{{ d.diff }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
              </div>
            </transition-group>
          </div>
        </div>
      </transition>

      <teleport to="body">
        <div :class="['fixed bottom-0 right-0 z-[9999] transform transition-all duration-300', showTop ? 'translate-x-0 opacity-100' : 'translate-x-24 opacity-0 pointer-events-none']">
          <button @click="scrollToTop" aria-label="回到顶部" title="回到顶部" class="w-8 h-8 rounded-lg bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 flex items-center justify-center">
            <i class="fa-solid fa-arrow-up text-xs"></i>
          </button>
        </div>
      </teleport>

      <div id="sr-status" class="sr-only" aria-live="polite" aria-atomic="true"></div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch, computed } from 'vue'
import { COLORS, COLOR_TO_PRIORITY, COLUMN_NAMES } from './constants'
import { sortByColorThenPN } from './utils/text'
import { initCdnStatusWatch, onStatusChange, enableAutoRecovery } from './services/cdn'
import { parseBOMAuto } from './services/parsing'
import { compareBOMFiles, compareWires } from './services/compare'
import { exportBOMPairToXlsx } from './services/exporter'
import { cleanBOM } from './services/clean'
import type { BOMFile, FileStatus } from './types/file'

// ================== 组件代码开始 ==================

// 本地文件列表项类型（用于展示与选择）
// 核心数据状态
// 存储解析后的 BOMFile（key=显示名），源数据唯一真相
const bomMap = reactive<Record<string, BOMFile>>({})
// 文件显示顺序（用于列表渲染与删除）
const filesOrder = reactive<string[]>([])
// 对比结果缓存：key = `${left}__${right}`
const compareCache = reactive<Record<string, { left: BOMFile; right: BOMFile; wires: { left: any[]; right: any[] }; counts: Record<string, any> }>>({})
// 文件元信息（行数、解析状态、错误信息）
type FileMeta = { status: 'pending' | 'success' | 'error'; rows: number; errorMsg?: string }
const fileMeta = reactive<Record<string, FileMeta>>({})
const selectedFiles = ref<string[]>([])

const dataEpoch = ref(0)

// 筛选缓存（保留以提供筛选功能）
const filteredCache = reactive<Record<string, any[]>>({})

// 轻量预览状态（仅标识当前两侧的文件名与对比开关）
const previewState = ref<any>({
  left: { fileName: '', isActive: false },
  right: { fileName: '', isActive: false },
  comparison: { isEnabled: false, lastUpdated: null }
})

// UI 交互状态
const containerVisible = ref(false)
const displayedSelectedFiles = ref<string[]>([])
// 原始数据单表查看：非空表示处于原始数据查看模式，仅显示该文件
const originalViewFile = ref<string>('')
const visibleSelectedFiles = computed<string[]>(() => displayedSelectedFiles.value.filter((name) => getTableDisplayData(name).columns.length > 0))
const previewWrap = ref<HTMLElement | null>(null)
const subtitle = ref('V2.7 - 网页版')
const loading = ref(false)
const compareMode = ref(false)
const multiCompareMode = ref(false)
const compareBusy = ref(false)

// 当 compareMode 打开时触发一次对比
watch(compareMode, (enabled) => {
  if (!enabled) return
  if (previewState.value.left.isActive && previewState.value.right.isActive) {
    performComparisonForPreview()
  }
})

// 执行预览对比（使用新 compare 服务）
function colorToPriority(argb?: string): 0|1|2|3 {
  switch (argb) {
    case COLORS.LIGHT_RED: return 0
    case COLORS.ORANGE: return 1
    case COLORS.LIGHT_BLUE: return 2
    case COLORS.LIGHT_GREEN: return 3
    default: return 3
  }
}

async function performComparisonForPreview() {
  if (compareBusy.value) return
  compareBusy.value = true
  try {
  const leftName = previewState.value.left.fileName
  const rightName = previewState.value.right.fileName
    const L = bomMap[leftName]
    const R = bomMap[rightName]
    if (!L || !R) return

    // 1) BOM 行对比，返回着色后的副本
    const { left: Lc, right: Rc } = await compareBOMFiles(L, R)

    // 2) 统计并映射到 UI 数据结构
    const makeDisplay = (file: BOMFile) => {
      const headers = file.cleaned.headers
      const rows = file.cleaned.rows
      // counts
      const counts = { red: 0, orange: 0, blue: 0, green: 0 }
      // flat rows with _compareCategory
      const data = rows.map((r) => {
        const obj: any = {}
        for (const h of headers) obj[h] = r.data[h]
        const p = colorToPriority(r.colorCategory as any)
        obj._compareCategory = p
        switch (p) {
          case 0: counts.red++; break
          case 1: counts.orange++; break
          case 2: counts.blue++; break
          case 3: counts.green++; break
        }
        return obj
      })
      return { headers, data, counts }
    }

    const Ld = makeDisplay(Lc)
    const Rd = makeDisplay(Rc)

    // 3) 导线差值（两方向）并转换为 UI 所需结构
    const wires = await compareWires(Lc, Rc)
    const leftWires = wires.left.map((w) => ({ pn: w['零件号'], type: w['类型'], q1: w['本表数量'], q2: w['对表数量'], diff: w['本表数量'] - w['对表数量'] }))
    const rightWires = wires.right.map((w) => ({ pn: w['零件号'], type: w['类型'], q1: w['本表数量'], q2: w['对表数量'], diff: w['本表数量'] - w['对表数量'] }))

  // 4) 写入对比缓存（按排序后的 pairKey，保证读写一致）
  const pairKey = leftName < rightName ? `${leftName}__${rightName}` : `${rightName}__${leftName}`
    compareCache[pairKey] = {
      left: Lc,
      right: Rc,
      wires: { left: leftWires, right: rightWires },
      counts: { [leftName]: Ld.counts, [rightName]: Rd.counts }
    }

    previewState.value.comparison.lastUpdated = new Date()
  // 触发预览重算（包含颜色优先排序）
  dataEpoch.value++
    compareMode.value = true
  } catch (error) {
    console.error('Preview comparison failed:', error)
  } finally {
    compareBusy.value = false
  }
}

// 从数据中提取列名的辅助函数
function getColumnsFromData(data: any[]): string[] {
  if (!data || data.length === 0) return []
  const firstRow = data[0]
  if (!firstRow || typeof firstRow !== 'object') return []
  return Object.keys(firstRow).filter(key => !key.startsWith('_'))
}

// 将 BOMFile.cleaned 转换为展示数据
function toDisplay(file: BOMFile): { columns: string[]; data: any[] } {
  const headers = file.cleaned.headers
  const rows = file.cleaned.rows
  const data = rows.map(r => {
    const obj: any = {}
    for (const h of headers) obj[h] = r.data[h]
    return obj
  })
  return { columns: headers.slice(), data }
}

const sheetReady = ref(false)
const sjsReady = ref(false)
const faReady = ref(false)
const sheetBadge = reactive({ show: true, bgClass: 'bg-blue-600', text: 'ExcelJS 加载中...' })
const sjsBadge = reactive({ show: true, bgClass: 'bg-blue-600', text: 'SheetJS 加载中...' })
const faBadge = reactive({ show: true, bgClass: 'bg-blue-600', text: '图标库加载中...' })

const colorFilters = reactive<Record<string, string | undefined>>({})
function toggleColorFilter(fileName: string, color: 'red' | 'orange' | 'blue' | 'green') {
  if (!compareMode.value || displayedSelectedFiles.value.length !== 2) return
  colorFilters[fileName] = colorFilters[fileName] === color ? undefined : color
}
function badgeClass(fileName: string, color: 'red' | 'orange' | 'blue' | 'green') {
  const active = colorFilters[fileName] === color
  const base = 'text-[10px] px-1.5 py-0.5 rounded min-w-[1.75rem] text-center border transition'
  const map: Record<string, string> = {
    red: active ? 'bg-red-600 text-white border-red-600' : 'bg-red-50 text-red-700 border-red-100',
    orange: active ? 'bg-orange-500 text-white border-orange-500' : 'bg-orange-50 text-orange-700 border-orange-100',
    blue: active ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 border-blue-100',
    green: active ? 'bg-green-600 text-white border-green-600' : 'bg-green-50 text-green-700 border-green-100',
  }
  return base + ' ' + map[color]
}

// CDN 状态监听与自动恢复
onMounted(() => {
  initCdnStatusWatch({ timeoutMs: 10_000, intervalMs: 200 })
  enableAutoRecovery({ mode: 'reload', maxAttempts: 2, delayMs: 1500 })

  onStatusChange('exceljs', (s) => {
    if (s === 'ready') {
      sheetReady.value = true
      sheetBadge.bgClass = 'bg-green-600'
      sheetBadge.text = 'ExcelJS 已就绪'
      setTimeout(() => (sheetBadge.show = false), 2000)
    } else if (s === 'loading' || s === 'idle') {
      sheetReady.value = false
      sheetBadge.show = true
      sheetBadge.bgClass = 'bg-blue-600'
      sheetBadge.text = 'ExcelJS 加载中...'
    } else if (s === 'timeout') {
      sheetReady.value = false
      sheetBadge.show = true
      sheetBadge.bgClass = 'bg-red-600'
      sheetBadge.text = 'ExcelJS 加载超时，正在重试...'
    } else if (s === 'error') {
      sheetReady.value = false
      sheetBadge.show = true
      sheetBadge.bgClass = 'bg-red-600'
      sheetBadge.text = 'ExcelJS 加载失败'
    }
  })

  onStatusChange('sheetjs', (s) => {
    if (s === 'ready') {
      sjsReady.value = true
      sjsBadge.bgClass = 'bg-green-600'
      sjsBadge.text = 'SheetJS 已就绪'
      setTimeout(() => (sjsBadge.show = false), 2000)
    } else if (s === 'loading' || s === 'idle') {
      sjsReady.value = false
      sjsBadge.show = true
      sjsBadge.bgClass = 'bg-blue-600'
      sjsBadge.text = 'SheetJS 加载中...'
    } else if (s === 'timeout') {
      sjsReady.value = false
      sjsBadge.show = true
      sjsBadge.bgClass = 'bg-red-600'
      sjsBadge.text = 'SheetJS 加载超时，正在重试...'
    } else if (s === 'error') {
      sjsReady.value = false
      sjsBadge.show = true
      sjsBadge.bgClass = 'bg-red-600'
      sjsBadge.text = 'SheetJS 加载失败'
    }
  })

  onStatusChange('fontawesome', (s) => {
    if (s === 'ready') {
      faReady.value = true
      faBadge.bgClass = 'bg-green-600'
      faBadge.text = '图标库加载完毕'
      setTimeout(() => (faBadge.show = false), 2000)
    } else if (s === 'loading' || s === 'idle') {
      faReady.value = false
      faBadge.show = true
      faBadge.bgClass = 'bg-blue-600'
      faBadge.text = '图标库加载中...'
    } else if (s === 'timeout') {
      faReady.value = false
      faBadge.show = true
      faBadge.bgClass = 'bg-red-600'
      faBadge.text = '图标库加载超时，正在重试...'
    } else if (s === 'error') {
      faReady.value = false
      faBadge.show = true
      faBadge.bgClass = 'bg-red-600'
      faBadge.text = '图标库加载失败'
    }
  })
})

// modules are bundled; no polling needed

const showTop = ref(false)
const atTop = () => {
  const y = window.scrollY || document.documentElement.scrollTop || (document.body as any).scrollTop || 0
  if (y > 0) return false
  const scrollers = document.querySelectorAll('[class*="overflow-"], [style*="overflow"], table, tbody')
  for (const el of Array.from(scrollers)) {
    try {
      const cs = getComputedStyle(el as Element)
      const oy = (cs as any).overflowY || (cs as any).overflow
      if (/(auto|scroll)/.test(oy as any) && (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight && (el as HTMLElement).scrollTop > 0) return false
    } catch {}
  }
  return true
}
const updateBackTop = () => {
  showTop.value = !atTop()
}
const forceShowBackTop = () => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(updateBackTop)
  else setTimeout(updateBackTop, 0)
}
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
onMounted(() => {
  window.addEventListener('scroll', updateBackTop, { passive: true })
  document.addEventListener('scroll', updateBackTop as any, { passive: true, capture: true } as any)
  document.addEventListener('wheel', forceShowBackTop as any, { passive: true } as any)
  document.addEventListener('touchmove', forceShowBackTop as any, { passive: true } as any)
  const onDocClick = (e: any) => {
    const path: any[] = e.composedPath ? e.composedPath() : []
    const isPanel = path.some((el) => el && el.classList && el.classList.contains('filter-panel'))
    const isBtn = path.some((el) => el && el.classList && el.classList.contains('filter-btn'))
    if (isPanel || isBtn) return
    Object.keys(filterUI).forEach((fn) => {
      const cols = (filterUI as any)[fn] || {}
      Object.keys(cols).forEach((cn) => {
        cols[cn].open = false
      })
    })
    openDropdownKey.value = ''
  }
  document.addEventListener('click', onDocClick as any, { capture: true } as any)
  const recompute = () => {
    const key = openDropdownKey.value
    if (!key) return
    const btn = document.querySelector(`.filter-btn[data-filter-key="${(window as any).CSS.escape(key)}"]`)
    if (!btn) return
    const rect = (btn as HTMLElement).getBoundingClientRect()
    ;(dropdownPositions as any)[key] = { top: rect.bottom + 4, left: rect.left }
  }
  window.addEventListener('resize', recompute as any, { passive: true } as any)
  window.addEventListener('scroll', recompute as any, { passive: true } as any)
  updateBackTop()
  ;(window as any).__bom_onDocClick = onDocClick
  ;(window as any).__bom_recompute = recompute
})
onUnmounted(() => {
  window.removeEventListener('scroll', updateBackTop)
  document.removeEventListener('scroll', updateBackTop as any, { capture: true } as any)
  document.removeEventListener('wheel', forceShowBackTop as any)
  document.removeEventListener('touchmove', forceShowBackTop as any)
  if ((window as any).__bom_onDocClick) document.removeEventListener('click', (window as any).__bom_onDocClick, { capture: true } as any)
  if ((window as any).__bom_recompute) {
    window.removeEventListener('resize', (window as any).__bom_recompute)
    window.removeEventListener('scroll', (window as any).__bom_recompute)
  }
})

function updatePreviewFiles() {
  const newVal = selectedFiles.value
  const n = (newVal || []).length
  const previewFiles: string[] = []
  if (n > 0) previewFiles.push(...(n <= 2 ? newVal : newVal.slice(-2)))
  
  if (previewFiles.length === 0) {
    compareMode.value = false
    displayedSelectedFiles.value = []
    // 清空预览状态
  previewState.value.left = { fileName: '', isActive: false }
  previewState.value.right = { fileName: '', isActive: false }
    previewState.value.comparison.isEnabled = false
  originalViewFile.value = ''
    if (containerVisible.value) setTimeout(() => (containerVisible.value = false), 100)
    return
  }
  
  // 更新显示的文件列表
  displayedSelectedFiles.value = [...previewFiles]
  
  // 更新预览状态
  const leftFileName = previewFiles[0] || ''
  const rightFileName = previewFiles[1] || ''
  
  // 更新左侧/右侧预览（仅记录文件名）
  if (leftFileName && bomMap[leftFileName]) {
    previewState.value.left = { fileName: leftFileName, isActive: true }
  } else {
    previewState.value.left = { fileName: '', isActive: false }
  }
  if (rightFileName && bomMap[rightFileName]) {
    previewState.value.right = { fileName: rightFileName, isActive: true }
  } else {
    previewState.value.right = { fileName: '', isActive: false }
  }
  
  // 更新对比状态
  previewState.value.comparison.isEnabled = compareMode.value && previewFiles.length === 2
  
  // 确保容器可见
  if (!containerVisible.value) {
    containerVisible.value = true
  }

  // 若已开启对比模式且两侧都有数据，则立即刷新对比
  if (compareMode.value && previewFiles.length === 2 &&
      previewState.value.left.isActive && previewState.value.right.isActive) {
    performComparisonForPreview()
  }
}

watch(selectedFiles, (newVal: string[], oldVal: string[]) => {
  updatePreviewFiles()
})

function onPreviewContainerAfterLeave() {
  if ((selectedFiles.value || []).length === 0) displayedSelectedFiles.value = []
}
function onBeforeEnter(el: Element) {
  const node = el as HTMLElement
  node.style.height = '0'
  node.style.opacity = '0'
}
function onEnter(el: Element, done: () => void) {
  const node = el as HTMLElement
  node.offsetHeight
  node.style.height = 'auto'
  const height = node.offsetHeight
  node.style.height = '0'
  requestAnimationFrame(() => {
    node.style.height = height + 'px'
    node.style.opacity = '1'
    setTimeout(done, 600)
  })
}
function onAfterEnter(el: Element) {
  const node = el as HTMLElement
  node.style.height = 'auto'
}
function onBeforeLeave(el: Element) {
  const node = el as HTMLElement
  node.style.height = node.offsetHeight + 'px'
  node.style.opacity = '1'
}
function onLeave(el: Element, done: () => void) {
  const node = el as HTMLElement
  node.offsetHeight
  requestAnimationFrame(() => {
    node.style.height = '0'
    node.style.opacity = '0'
    setTimeout(done, 600)
  })
}

function cardWidth(idx: number, fileName: string) {
  const len = visibleSelectedFiles.value.length
  if (len === 1) return '100%'
  return 'calc((100% - 1.5rem) / 2)'
}
function cardStyle(idx: number, fileName: string) {
  const w = cardWidth(idx, fileName)
  return { width: w, flexBasis: w, flexShrink: 0, minWidth: 0, overflow: 'hidden' }
}

function generateUniqueFileName(originalName: string) {
  let displayName = originalName
  let counter = 2
  while (filesOrder.includes(displayName)) {
    displayName = `${originalName} (${counter})`
    counter++
  }
  return displayName
}

async function handleFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  loading.value = true
  await Promise.all(
    files.map((file) =>
      new Promise<void>(async (resolve) => {
        const displayName = generateUniqueFileName(file.name)
        filesOrder.push(displayName)
        fileMeta[displayName] = { status: 'pending', rows: 0, errorMsg: '' }
        try {
          // 1) 解析
          const parsed = await parseBOMAuto(file, displayName)
          // 2) 清洗（标准化/聚合/排序）
          const cleaned = await cleanBOM(parsed)
          // 3) 存储仅使用清洗后的 BOMFile
          bomMap[displayName] = cleaned
          const rowsCount = cleaned.cleaned.metadata?.rowCount || (cleaned.cleaned.rows?.length || 0)
          fileMeta[displayName] = { status: 'success', rows: rowsCount, errorMsg: '' }
          
          dataEpoch.value++
          // 预热缓存，提升后续筛选与预览性能
          warmupCaches(displayName)
        } catch (err: any) {
          let errorMessage = ''
          const originalError = err && err.message ? err.message : err
          if (typeof originalError === 'string') {
            // 新的错误码格式处理
            if (originalError.includes('[CDN_MISSING_SHEETJS]')) errorMessage = `依赖库未就绪: SheetJS 还未加载完成，请稍后重试`
            else if (originalError.includes('[CDN_MISSING_EXCELJS]')) errorMessage = `依赖库未就绪: ExcelJS 还未加载完成，请稍后重试`
            else if (originalError.includes('[PARSE_MISSING_KEY]')) {
              // 解析新的错误消息格式
              if (originalError.includes('缺少必要列：')) {
                errorMessage = `文件格式错误: ${originalError.replace(/.*\[PARSE_MISSING_KEY\]\s*/, '')}`
              } else {
                errorMessage = `文件格式错误: 未找到必要列（零件号或供应商零件号）`
              }
            }
            else if (originalError.includes('[PARSE_EMPTY]')) errorMessage = `文件内容错误: 工作表为空或没有数据`
            else if (originalError.includes('[UNSUPPORTED_TYPE]')) errorMessage = `文件格式不支持: ${originalError.replace(/.*\[UNSUPPORTED_TYPE\]\s*/, '')}`
            else if (originalError.includes('[INVALID_FILE]')) errorMessage = `文件错误: 无效的文件对象`
            else if (originalError.includes('[PARSE_ERROR]')) errorMessage = `解析错误: ${originalError.replace(/.*\[PARSE_ERROR\]\s*/, '')}`
            else errorMessage = `文件解析失败: ${originalError}`
          } else errorMessage = `文件解析过程中出现未知错误`
          fileMeta[displayName] = { status: 'error', rows: 0, errorMsg: errorMessage }
        }
        resolve()
      }),
    ),
  )
  loading.value = false
}

function removeFile(idx: number) {
  if (idx < 0 || idx >= filesOrder.length) return
  const name = filesOrder[idx]
  filesOrder.splice(idx, 1)
  const selIdx = selectedFiles.value.indexOf(name)
  if (selIdx !== -1) selectedFiles.value.splice(selIdx, 1)
  dataEpoch.value++
  
  // 清理缓存
  delete bomMap[name]
  delete fileMeta[name]
  // 删除 compareCache 中相关 pair
  Object.keys(compareCache).forEach((k) => {
    if (k.includes(name)) delete compareCache[k]
  })
  
  // 清理预览状态中的数据
  if (previewState.value.left.fileName === name) {
    previewState.value.left = { fileName: '', isActive: false }
  }
  if (previewState.value.right.fileName === name) {
    previewState.value.right = { fileName: '', isActive: false }
  }
}

function onFileCheckboxChange(name: string, checked: boolean, status: string) {
  if (status === 'error') return
  if (originalViewFile.value) originalViewFile.value = ''
  const i = selectedFiles.value.indexOf(name)
  if (checked) {
    if (i === -1) {
      if (multiCompareMode.value) {
        selectedFiles.value.push(name)
      } else {
        if (selectedFiles.value.length >= 2) selectedFiles.value.shift()
        selectedFiles.value.push(name)
      }
    }
  } else {
    if (i >= 0) {
      selectedFiles.value.splice(i, 1)
    }
  }
  updatePreviewFiles()
}

function toggleMultiCompare() {
  multiCompareMode.value = !multiCompareMode.value
  if (multiCompareMode.value) compareMode.value = false
  else {
    selectedFiles.value = []
    ;(containerVisible as any).value = false
    compareMode.value = false
  originalViewFile.value = ''
  }
}
function selectAllFiles() {
  if (!multiCompareMode.value) return
  const all = filesOrder.filter((n) => (fileMeta[n]?.status !== 'error'))
  selectedFiles.value.splice(0, selectedFiles.value.length, ...all)
}

// 预热缓存函数，在文件导入后立即建立各种缓存
function warmupCaches(fileName: string) {
  try {
    // 1. 建立显示数据缓存和行索引映射
    getTableDisplayData(fileName)
    
    // 2. 建立基础筛选缓存
    baseFilteredRows(fileName)
    
    // 3. 如果有列数据，可以预建立一些筛选状态
  const displayData = getTableDisplayData(fileName)
    if (displayData && displayData.columns.length > 0) {
      // 初始化筛选UI状态（但不设置实际筛选）
      displayData.columns.forEach((col: string) => {
        keyOf(fileName, col) // 这会初始化筛选UI状态
      })
    }
  } catch (err) {
    // 缓存预热失败不应该影响主流程
    console.warn('Cache warmup failed for', fileName, err)
  }
}

function getTable(name: string) {
  const f = bomMap[name]
  if (!f) return null
  return f
}

// 从预览状态或原始缓存获取显示数据
function getTableDisplayData(name: string) {
  // 原始数据查看模式：直接显示 original，hasCleaned=true 的行加删除线
  if (originalViewFile.value && originalViewFile.value === name) {
    const file = bomMap[name]
    if (!file) return { columns: [], data: [] }
    const headers = file.original.headers
    const data = file.original.rows.map((r) => {
      const obj: any = {}
      for (const h of headers) obj[h] = r.data[h]
  // 标记删除线
  obj._strikethrough = !!r.hasCleaned
  // 传递原始行颜色（例如清洗被合并行的 GRAY）
  if (r.colorCategory) obj._colorArgb = r.colorCategory
      return obj
    })
    return { columns: headers.slice(), data }
  }
  const file = bomMap[name]
  if (!file) return { columns: [], data: [] }
  // 如果在对比模式，且缓存有着色副本，则以着色副本渲染并添加 _compareCategory
  if (compareMode.value && displayedSelectedFiles.value.length === 2) {
    const other = getOtherFileName(name)
    if (other) {
      const pairKey = name < other ? `${name}__${other}` : `${other}__${name}`
      const entry = compareCache[pairKey]
      if (entry) {
        const colored = entry.left.name === name ? entry.left : entry.right
        const headers = colored.cleaned.headers
        const data = colored.cleaned.rows.map((r) => {
          const obj: any = {}
          for (const h of headers) obj[h] = r.data[h]
          obj._colorArgb = r.colorCategory as any
          obj._compareCategory = colorToPriority(r.colorCategory as any)
          return obj
        })
        return { columns: headers.slice(), data }
      }
    }
  }
  // 默认返回清洗后的原始表
  return toDisplay(file)
}

// 触发原始数据查看：关闭对比、清空预览，仅显示点击的文件（original）
function showOriginal(name: string) {
  compareMode.value = false
  previewState.value.comparison.isEnabled = false
  // 选择该文件：清空已选，加入目标
  selectedFiles.value.splice(0, selectedFiles.value.length, name)
  // 只显示一个文件
  displayedSelectedFiles.value = [name]
  // 标记原始查看对象
  originalViewFile.value = name
  // 展开预览容器
  if (!containerVisible.value) containerVisible.value = true
}

// 旧的 ExcelJS 行样式操作已移除

const filterUI = reactive<Record<string, any>>({})
const activeFilters = reactive<Record<string, Record<string, Set<string>>>>({})
const dropdownPositions = reactive<Record<string, { top: number; left: number }>>({})
const openDropdownKey = ref('')

function keyOf(fileName: string, col: string) {
  if (!filterUI[fileName]) (filterUI as any)[fileName] = {}
  if (!filterUI[fileName][col]) (filterUI as any)[fileName][col] = { open: false, search: '', temp: new Set<string>() }
  return (filterUI as any)[fileName][col]
}
function toggleFilterDropdown(fileName: string, col: string, evt: Event) {
  const k = keyOf(fileName, col)
  k.open = !k.open
  const selected = activeFilters[fileName] && activeFilters[fileName][col] ? activeFilters[fileName][col] : new Set<string>()
  k.temp = new Set<string>(Array.from(selected))
  const key = `${fileName}__${col}`
  if (k.open && evt && (evt as any).currentTarget) {
    const rect = ((evt as any).currentTarget as HTMLElement).getBoundingClientRect()
    ;(dropdownPositions as any)[key] = { top: rect.bottom + 4, left: rect.left }
    openDropdownKey.value = key
  } else if (!k.open && openDropdownKey.value === key) openDropdownKey.value = ''
}
function closeDropdown(fileName: string, col: string) {
  const k = keyOf(fileName, col)
  k.open = false
  if (openDropdownKey.value === `${fileName}__${col}`) openDropdownKey.value = ''
}
function isDropdownOpen(fileName: string, col: string) {
  return !!(filterUI[fileName] && filterUI[fileName][col] && filterUI[fileName][col].open)
}
function getFilterState(fileName: string, col: string) {
  return keyOf(fileName, col)
}
function dropdownStyle(fileName: string, col: string) {
  const key = `${fileName}__${col}`
  const pos = (dropdownPositions as any)[key] || { top: 0, left: 0 }
  const panelWidth = 256
  const panelHeight = 320
  let top = pos.top
  let left = pos.left
  const vw = window.innerWidth || document.documentElement.clientWidth
  const vh = window.innerHeight || document.documentElement.clientHeight
  if (left + panelWidth > vw - 8) left = Math.max(8, vw - panelWidth - 8)
  if (top + panelHeight > vh - 8) top = Math.max(8, vh - panelHeight - 8)
  return `top:${top}px;left:${left}px;`
}
function collectDistinctValues(fileName: string, col: string) {
  const table = getTable(fileName)
  if (!table) return []
  
  const displayData = getTableDisplayData(fileName)
  const set = new Set<string>()
  ;(displayData.data || []).forEach((r: any) => set.add(String((r && r[col]) ?? '')))
  return Array.from(set)
}
function filteredDistinctValues(fileName: string, col: string) {
  const state = getFilterState(fileName, col)
  const search = (state.search || '').toLowerCase()
  const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })
  return collectDistinctValues(fileName, col)
    .filter((v) => v.toLowerCase().includes(search))
    .sort((a, b) => collator.compare(a, b))
}
function isValueChecked(fileName: string, col: string, val: string) {
  return getFilterState(fileName, col).temp.has(String(val ?? ''))
}
function onToggleValue(fileName: string, col: string, val: string, checked: boolean) {
  const state = getFilterState(fileName, col)
  const key = String(val ?? '')
  if (checked) state.temp.add(key)
  else state.temp.delete(key)
}
function selectAllValues(fileName: string, col: string) {
  const state = getFilterState(fileName, col)
  state.temp = new Set<string>(collectDistinctValues(fileName, col).map((v) => String(v ?? '')))
}
function clearAllValues(fileName: string, col: string) {
  ;(getFilterState(fileName, col) as any).temp = new Set<string>()
}
function applyFilter(fileName: string, col: string) {
  if (!activeFilters[fileName]) (activeFilters as any)[fileName] = {}
  ;(activeFilters as any)[fileName][col] = new Set<string>(Array.from(getFilterState(fileName, col).temp))
  closeDropdown(fileName, col)
}
function isColumnFiltered(fileName: string, col: string) {
  return !!(activeFilters[fileName] && activeFilters[fileName][col] && activeFilters[fileName][col].size > 0)
}
function hasActiveFilters(fileName: string) {
  const f = activeFilters[fileName] || {}
  return Object.values(f).some((set: any) => set && (set as Set<string>).size > 0)
}
function baseFilteredRows(fileName: string) {
  const table = getTable(fileName)
  if (!table) return []
  
  const displayData = getTableDisplayData(fileName)
  const rows = displayData.data || []
  const filters = activeFilters[fileName] || {}
  const cols = displayData.columns || []
  const hasAny = Object.values(filters).some((set: any) => set && (set as Set<string>).size > 0)
  return hasAny
    ? rows.filter((r: any) => cols.every((col: string) => {
        const set = (filters as any)[col]
        if (!set || set.size === 0) return true
        const key = String((r && r[col]) ?? '')
        return set.has(key)
      }))
    : rows
}
function filteredRows(fileName: string) {
  // 创建缓存键
  const colorFilter = colorFilters[fileName] || ''
  const activeFiltersKey = JSON.stringify(activeFilters[fileName] || {})
  const ts = previewState.value.comparison.lastUpdated ? +new Date(previewState.value.comparison.lastUpdated as any) : 0
  const cacheKey = `${fileName}-${compareMode.value}-${colorFilter}-${activeFiltersKey}-${dataEpoch.value}-${ts}-${originalViewFile.value}`
  
  // 检查缓存
  if (filteredCache[cacheKey]) {
    return filteredCache[cacheKey]
  }
  
  const table = getTable(fileName)
  if (!table) return []
  
  const displayData = getTableDisplayData(fileName)
  const cols = displayData.columns || []
  let result = baseFilteredRows(fileName)
  
  if (!originalViewFile.value && compareMode.value && displayedSelectedFiles.value.length === 2 && colorFilters[fileName]) {
    const want = COLOR_TO_PRIORITY[colorFilters[fileName] as string]
    result = result.filter((r: any) => categoryPriority(fileName, r) === want)
  }
  if (!originalViewFile.value && compareMode.value && displayedSelectedFiles.value.length === 2 && cols.includes('零件号')) {
    // 使用共享排序（需要提供颜色分类），先映射临时结构再还原
    const mapped = result.map((row: any) => ({ colorCategory: (row && row._colorArgb) ? row._colorArgb : (() => {
      const p = categoryPriority(fileName, row)
  switch (p) { case 0: return COLORS.LIGHT_RED; case 1: return COLORS.ORANGE; case 2: return COLORS.LIGHT_BLUE; case 3: return COLORS.LIGHT_GREEN; default: return '' }
    })(), data: { ['零件号']: row['零件号'] } as any, _orig: row }))
    const sorted = sortByColorThenPN(mapped, '零件号')
    result = sorted.map((m: any) => m._orig)
  }
  
  // 缓存结果
  filteredCache[cacheKey] = result
  return result
}

async function toggleCompare() {
  if (compareMode.value) {
    // 关闭对比模式
    compareMode.value = false
    previewState.value.comparison.isEnabled = false
    return
  }
  
  if (compareBusy.value) return
  if (displayedSelectedFiles.value.length !== 2) return
  
  // 启用对比模式
  compareMode.value = true
  previewState.value.comparison.isEnabled = true
  // 立即执行一次对比
  await performComparisonForPreview()
}

function getOtherFileName(current: string) {
  if (displayedSelectedFiles.value.length !== 2) return null
  return displayedSelectedFiles.value[0] === current ? displayedSelectedFiles.value[1] : displayedSelectedFiles.value[0]
}
function categoryPriority(fileName: string, row: any) {
  // 从 compareCache 获取对比结果，按 PN 在着色 BOM 中查找颜色
  const other = getOtherFileName(fileName)
  if (!other) return 3
  const pairKey = fileName < other ? `${fileName}__${other}` : `${other}__${fileName}`
  const entry = compareCache[pairKey]
  if (!entry) return 3
  // entry.left/entry.right 的内含 name 由 compareBOMFiles 保持原名；但缓存键已经排序，需根据 name 选择
  const colored = entry.left.name === fileName ? entry.left : (entry.right.name === fileName ? entry.right : entry.left)
  const pn = String(row['零件号'] ?? '').trim()
  const found = colored.cleaned.rows.find((r) => String(r.data['零件号'] ?? '').trim() === pn)
  if (!found) return 3
  return colorToPriority(found.colorCategory as any)
}
function rowBgClass(fileName: string, row: any) {
  if (!compareMode.value) return ''
  
  // 从处理后的数据中获取对比分类
  if (row._compareCategory !== undefined) {
    switch (row._compareCategory) {
      case 0: return 'bg-red-50'
      case 1: return 'bg-orange-50'  
      case 2: return 'bg-blue-50'
      case 3: return 'bg-green-50'
      default: return ''
    }
  }
  
  // 直接使用 categoryPriority 获取颜色分类
  const p = categoryPriority(fileName, row)
  switch (p) {
    case 0: return 'bg-red-50'
    case 1: return 'bg-orange-50'
    case 2: return 'bg-blue-50'
    case 3: return 'bg-green-50'
    default: return ''
  }
}
function rowBgStyle(fileName: string, row: any) {
  // 如果 display 数据包含 _colorArgb，则用 ARGB 转换为 rgba 作为背景色（保留透明度）
  if (row && row._colorArgb) {
    const argb = String(row._colorArgb)
    if (argb && argb.length === 8) {
      // ARGB (AARRGGBB) -> rgba(r,g,b,a)
      const a = parseInt(argb.slice(0, 2), 16) / 255
      const r = parseInt(argb.slice(2, 4), 16)
      const g = parseInt(argb.slice(4, 6), 16)
      const b = parseInt(argb.slice(6, 8), 16)
      return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})` }
    }
  }
  return {}
}
function categoryCounts(fileName: string) {
  const other = getOtherFileName(fileName)
  if (other) {
    const pairKey = fileName < other ? `${fileName}__${other}` : `${other}__${fileName}`
    const entry = compareCache[pairKey]
    if (entry && entry.counts && entry.counts[fileName]) return entry.counts[fileName]
  }
  return { red: 0, orange: 0, blue: 0, green: 0 }
}
function wiresDiff(fileName: string) {
  const other = getOtherFileName(fileName)
  if (other) {
    const pairKey = fileName < other ? `${fileName}__${other}` : `${other}__${fileName}`
    const entry = compareCache[pairKey]
    if (!entry) return []
    // 返回与当前 fileName 对应方向的导线差异
  return entry.left.name === fileName ? entry.wires.left : (entry.right.name === fileName ? entry.wires.right : entry.wires.left)
  }
  return []
}

// 新导出：调用 exporter.exportBOMPairToXlsx
async function exportCompare() {
  try {
    const n = selectedFiles.value.length
    if (n === 0) return
    if (n === 1) {
      const a = selectedFiles.value[0]
      const A = bomMap[a]
      if (!A) return
      await exportBOMPairToXlsx(A, undefined, a)
      return
    }
    if (n === 2) {
      const [a, b] = selectedFiles.value
      const A = bomMap[a]
      const B = bomMap[b]
      if (!A || !B) return
      // 若已有 compareCache 则复用，否则现比
      const pairKey = a < b ? `${a}__${b}` : `${b}__${a}`
      let Lc: BOMFile; let Rc: BOMFile
      if (compareCache[pairKey]) {
        Lc = compareCache[pairKey].left
        Rc = compareCache[pairKey].right
      } else {
        const r = await compareBOMFiles(A, B)
        Lc = r.left; Rc = r.right
      }
      await exportBOMPairToXlsx(Lc, Rc, `对比结果_${a}_VS_${b}`)
      return
    }
    // 多文件：按两两组合导出
    const arr = selectedFiles.value.slice()
    for (let i = 0; i < arr.length - 1; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j]
        const A = bomMap[a], B = bomMap[b]
        if (!A || !B) continue
        const { left: Lc, right: Rc } = await compareBOMFiles(A, B)
        await exportBOMPairToXlsx(Lc, Rc, `对比结果_${a}_VS_${b}`)
      }
    }
  } catch (e: any) {
    alert('导出失败：' + (e?.message || e))
  }
}

// 旧导出逻辑已替换为 exportBOMPairToXlsx

function onOpenFileDialog() {
  ;(fileInputRef.value as any)?.click?.()
}
const fileInputRef = ref<HTMLInputElement | null>(null)

// 便捷：键盘与移动端增强
onMounted(() => {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      onOpenFileDialog()
    }
    if (e.key === 'Escape') {
      Object.keys(filterUI || {}).forEach((fileName) => {
        const cols = (filterUI as any)[fileName] || {}
        Object.keys(cols).forEach((colName) => {
          cols[colName].open = false
        })
      })
      openDropdownKey.value = ''
    }
  })
  if (/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    document.body.classList.add('mobile-device')
    setTimeout(() => {
      const tables = document.querySelectorAll('.overflow-auto')
      tables.forEach((container) => {
        if ((container as HTMLElement).scrollWidth > (container as HTMLElement).clientWidth) {
          container.setAttribute('data-swipe-hint', '👈 左右滑动查看更多')
        }
      })
    }, 1000)
  }
})
</script>

<style>
/* 迁移的全局样式（与原版一致） */
:root { --primary-blue:#2563eb; --primary-green:#059669; --primary-red:#dc2626; --primary-orange:#ea580c; --bg-gradient:linear-gradient(135deg,#f0f9ff 0%,#ffffff 50%,#fef7f7 100%); --shadow-soft:0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); --shadow-card:0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); --border-radius:12px; --transition-smooth:all 0.3s cubic-bezier(0.4,0,0.2,1); }
html{ overflow-y:overlay; scrollbar-gutter:stable; }
@supports not (overflow-y: overlay){ html{ overflow-y:auto; scrollbar-width:none; -ms-overflow-style:none; } html::-webkit-scrollbar{ display:none; } }
::-webkit-scrollbar{ width:12px; height:12px; }
::-webkit-scrollbar-track{ background:transparent; }
::-webkit-scrollbar-thumb{ background:rgba(156,163,175,0.3); border-radius:6px; border:2px solid transparent; background-clip:content-box; transition:var(--transition-smooth); }
::-webkit-scrollbar-thumb:hover{ background:rgba(107,114,128,0.6); background-clip:content-box; }
::-webkit-scrollbar-corner{ background:transparent; }
*{ scrollbar-width:thin; scrollbar-color:rgba(156,163,175,0.3) transparent; }
@supports not (overflow-y: overlay){ *{ scrollbar-width:none; -ms-overflow-style:none; } *::-webkit-scrollbar{ display:none; } }
body{ overflow-y:overlay; scrollbar-gutter:stable; }
@supports not (overflow-y: overlay){ body{ overflow-y:auto; scrollbar-width:none; -ms-overflow-style:none; } body::-webkit-scrollbar{ display:none; } }
.fade-enter-active, .fade-leave-active{ transition:opacity 0.4s cubic-bezier(0.4,0,0.2,1); }
.fade-enter-from, .fade-leave-to{ opacity:0; transform:translateY(-8px); }
.fadeout-leave-active{ transition:opacity 0.4s cubic-bezier(0.4,0,0.2,1); }
.fadeout-leave-to{ opacity:0; transform:translateY(-8px); }
.slide-down-enter-active, .slide-down-leave-active{ transition:max-height 0.5s cubic-bezier(0.4,0,0.2,1); overflow:hidden; }
.slide-down-enter-from{ max-height:0; opacity:0; }
.slide-down-enter-to{ max-height:9999px; opacity:1; }
.slide-down-leave-from{ max-height:9999px; opacity:1; }
.slide-down-leave-to{ max-height:0; opacity:0; }
.slide-up-enter-active{ transition:height 0.6s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.4s ease-in-out; overflow:hidden; }
.slide-up-leave-active{ transition:height 0.6s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.4s ease-in-out; overflow:hidden; }
.slide-up-enter-from{ height:0; opacity:0; }
.slide-up-enter-to{ height:auto; opacity:1; }
.slide-up-leave-from{ height:auto; opacity:1; }
.slide-up-leave-to{ height:0; opacity:0; }
.content-fade-enter-active{ transition: opacity 0.3s ease-in-out 0.2s; }
.content-fade-leave-active{ transition: opacity 0.2s ease-in-out; }
.content-fade-enter-from{ opacity:0; }
.content-fade-enter-to{ opacity:1; }
.content-fade-leave-from{ opacity:1; }
.content-fade-leave-to{ opacity:0.3; }
.preview-list-move, .preview-list-enter-active, .preview-list-leave-active{ transition: all 0.5s cubic-bezier(0.25,0.46,0.45,0.94); }
.preview-card{ transition: opacity 0.5s cubic-bezier(0.25,0.46,0.45,0.94); background:white; border-radius:var(--border-radius); box-shadow:var(--shadow-card); }
.preview-card:hover{ box-shadow:var(--shadow-soft); transform:translateY(-3px); }
.preview-list-enter-from{ opacity:0; transform:translateX(120%) scale(0.9); }
.preview-list-enter-to{ opacity:1; transform:translateX(0) scale(1); }
.preview-list-leave-from{ opacity:1; transform:translateX(0) scale(1); }
.preview-list-leave-to{ opacity:0; transform:translateX(-120%) scale(0.9); }
.preview-list-leave-active{ position:absolute; z-index:0; width:calc((100% - 1.5rem) / 2); }
.preview-list-move{ z-index:1; }
.preview-container{ position:relative; min-height:200px; overflow:hidden; }
.btn-modern{ transition:var(--transition-smooth); transform:translateY(0); box-shadow:var(--shadow-card); }
.btn-modern:hover{ transform:translateY(-2px); box-shadow:var(--shadow-soft); }
.btn-modern:active{ transform:translateY(0); }
.card-modern{ background:rgba(255,255,255,0.95); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.2); box-shadow:var(--shadow-card); transition:var(--transition-smooth), height 0.4s cubic-bezier(0.25,0.46,0.45,0.94); }
.card-modern:hover{ box-shadow:var(--shadow-soft); transform:translateY(-2px); }
.file-list-container{ background:rgba(255,255,255,0.8); border-radius:var(--border-radius); box-shadow:var(--shadow-card); transition:var(--transition-smooth); }
.file-list-container:hover{ background:rgba(255,255,255,0.95); box-shadow:var(--shadow-soft); transform:translateY(-2px); }
.file-item{ transition:var(--transition-smooth); border-radius:var(--border-radius); }
.file-item:hover{ box-shadow:var(--shadow-soft); transform:translateY(-1px); }
.file-item.selected{ background:linear-gradient(135deg,#dbeafe 0%,#bfdbfe 100%); border:1px solid #3b82f6; box-shadow:var(--shadow-card); transform:translateY(-1px); }
.file-item.selected:hover{ box-shadow:var(--shadow-soft); transform:translateY(-2px); }
.table-container{ border-radius:var(--border-radius); overflow:hidden; }
.filter-dropdown{ transition:var(--transition-smooth); border-radius:var(--border-radius); box-shadow:var(--shadow-card); }
.filter-dropdown:hover{ box-shadow:var(--shadow-soft); transform:translateY(-1px); }
.table-modern{ border-collapse:separate; border-spacing:0; overflow:hidden; border-radius:var(--border-radius); box-shadow:var(--shadow-card); }
.table-modern th{ background:linear-gradient(135deg,#f8fafc 0%, #f1f5f9 100%); position:sticky; top:0; z-index:10; }
.table-modern tbody tr:hover{ background-color:rgba(59,130,246,0.05); transform:scale(1.002); transition:var(--transition-smooth); }
.touch-friendly{ touch-action:manipulation; -webkit-tap-highlight-color:transparent; }
.focus-visible:focus{ outline:2px solid var(--primary-blue); outline-offset:2px; }
.gpu-accelerated{ transform:translateZ(0); will-change:transform; }
@media (max-width: 768px){ .mobile-optimized{ padding:12px; font-size:14px; } .btn-mobile{ min-height:44px; padding:12px 16px; } }
@supports not (backdrop-filter: blur(10px)){ .card-modern{ background:rgba(255,255,255,0.98); } }
</style>
