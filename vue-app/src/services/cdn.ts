/**
 * CDN 加载与全局约定
 *
 * 要求（与 README 对齐）：
 * - 在最终单文件 index.html 中，使用 CDN 异步引入以下资源：
 *   - Tailwind CSS v3（cdn.tailwindcss.com）
 *   - Font Awesome 6（cdnjs，带 jsDelivr 备用）
 *   - ExcelJS（window.ExcelJS）
 *   - SheetJS / XLSX（window.XLSX）
 *   - Vue 3：通过 import map 指向 ESM CDN（浏览器原生模块加载）
 * - 构建（singlefile 模式）时，将 vue 标记为 external，由浏览器从 import map 解析。
 * - 业务代码中不直接打包 exceljs/xlsx，依赖 window.ExcelJS / window.XLSX 全局（types 见 types/globals.d.ts）。
 */

type AnyFn = (...args: any[]) => any

// CDN 常量（与 index.html 对齐）
const CDN_EXCELJS = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
const CDN_SHEETJS = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
const CDN_TAILWIND = 'https://cdn.tailwindcss.com'
const CDN_FA = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css'
const CDN_FA_FALLBACK = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.2/css/all.min.css'

function injectScript(src: string, attrs: Record<string, string> = {}) {
    return new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src = src
        Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v))
        s.onload = () => resolve()
        s.onerror = () => reject(new Error(`CDN 加载失败: ${src}`))
        document.head.appendChild(s)
    })
}

function injectStyle(href: string) {
    return new Promise<void>((resolve, reject) => {
        const l = document.createElement('link')
        l.rel = 'stylesheet'
        l.href = href
        l.onload = () => resolve()
        l.onerror = () => reject(new Error(`CDN 加载失败: ${href}`))
        document.head.appendChild(l)
    })
}

/**
 * 兜底加载（仅在需要时可使用）。
 * 在正常构建里，index.html 已包含这些 CDN，不会执行到这里。
 * 现在使用异步加载策略，不阻塞页面渲染。
 */
export async function loadCDNs() {
    const promises: Promise<any>[] = []

    // ExcelJS - 异步加载
    if (!(window as any).ExcelJS) {
        promises.push(injectScript(CDN_EXCELJS, { async: 'true' }))
    }

    // XLSX - 异步加载
    if (!(window as any).XLSX) {
        promises.push(injectScript(CDN_SHEETJS, { async: 'true' }))
    }

    // Font Awesome（仅在样式缺失时补充）- 异步加载
    const hasFA = Array.from(document.styleSheets).some((s) => (s as CSSStyleSheet)?.href?.includes('font-awesome') || (s as CSSStyleSheet)?.href?.includes('fontawesome'))
    if (!hasFA) {
        promises.push(
            injectStyleAsync(CDN_FA).catch(() =>
                injectStyleAsync(CDN_FA_FALLBACK)
            )
        )
    }

    // Tailwind - 异步加载
    if (!(window as any).tailwind) {
        promises.push(injectScript(CDN_TAILWIND, { async: 'true' }))
    }

    // 使用Promise.allSettled避免一个失败影响其他资源
    const results = await Promise.allSettled(promises)
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.warn(`CDN资源加载失败 (${index}):`, result.reason)
        }
    })
}

/**
 * 异步样式注入函数，使用preload技术提高性能
 */
function injectStyleAsync(href: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        // 先创建preload link
        const preload = document.createElement('link')
        preload.rel = 'preload'
        preload.as = 'style'
        preload.href = href

        // 然后创建实际的stylesheet link
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = href

        link.onload = () => resolve()
        link.onerror = () => reject(new Error(`CDN 样式加载失败: ${href}`))

        // 添加到head
        document.head.appendChild(preload)

        // 延迟一点添加实际样式，让preload先执行
        setTimeout(() => {
            document.head.appendChild(link)
        }, 10)
    })
}

export function ensureGlobals() {
    const g = window as any
    if (!g.ExcelJS) throw new Error('ExcelJS 未加载（全局 ExcelJS 不存在）')
    if (!g.XLSX) throw new Error('SheetJS 未加载（全局 XLSX 不存在）')
}

// ---------------- 状态总线与轮询检测（用于 UI 展示“进行中/已完成/超时”）----------------

export type CdnKey = 'exceljs' | 'sheetjs' | 'tailwind' | 'fontawesome'
export type CdnState = 'idle' | 'loading' | 'ready' | 'timeout' | 'error'

type Bus = {
    listeners: Map<string, Set<AnyFn>>
    emit: (topic: string, state: CdnState, detail?: any) => void
    on: (topic: string, cb: (state: CdnState, detail?: any) => void) => () => void
}

function getBus(): Bus {
    const w = window as any
    if (!w.__cdn_bus) {
        w.__cdn_bus = {
            listeners: new Map<string, Set<AnyFn>>(),
            emit(topic: string, state: CdnState, detail?: any) {
                const set = this.listeners.get(topic)
                if (set) set.forEach((fn: AnyFn) => { try { fn(state, detail) } catch { } })
            },
            on(topic: string, cb: AnyFn) {
                if (!this.listeners.has(topic)) this.listeners.set(topic, new Set())
                this.listeners.get(topic)!.add(cb)
                return () => this.listeners.get(topic)!.delete(cb)
            }
        } as Bus
    }
    return w.__cdn_bus as Bus
}

function getStatusStore(): Record<CdnKey, CdnState> {
    const w = window as any
    if (!w.__cdn_status) {
        w.__cdn_status = {
            exceljs: 'idle',
            sheetjs: 'idle',
            tailwind: 'idle',
            fontawesome: 'idle'
        } as Record<CdnKey, CdnState>
    }
    return w.__cdn_status as Record<CdnKey, CdnState>
}

function setStatus(key: CdnKey, state: CdnState, detail?: any) {
    const store = getStatusStore()
    if (store[key] === state) return
    store[key] = state
    getBus().emit(key, state, detail)
}

export function getStatus(key: CdnKey): CdnState {
    return getStatusStore()[key]
}

export function onStatusChange(key: CdnKey, cb: (state: CdnState, detail?: any) => void) {
    // 立即推送一次当前状态，便于 UI 首次渲染
    try { cb(getStatus(key)) } catch { }
    return getBus().on(key, cb)
}

function waitFor(predicate: () => boolean, timeoutMs = 10_000, intervalMs = 200): Promise<'ready' | 'timeout'> {
    return new Promise((resolve) => {
        const start = Date.now()
        const tick = () => {
            if (predicate()) return resolve('ready')
            if (Date.now() - start >= timeoutMs) return resolve('timeout')
            setTimeout(tick, intervalMs)
        }
        tick()
    })
}

function isFontAwesomeReady(): boolean {
    // 通过字体加载 API 或样式表名来粗略判断
    const readyFlag = (window as any).__FA_LOADED
    if (readyFlag) return true
    // 样式表包含 font-awesome / fontawesome 关键字
    const hasCss = Array.from(document.styleSheets || []).some((s) => {
        const href = (s as CSSStyleSheet).href || ''
        return /font-?awesome/i.test(href)
    })
    return hasCss
}

export async function initCdnStatusWatch(options?: { timeoutMs?: number; intervalMs?: number }) {
    const timeoutMs = options?.timeoutMs ?? 10_000
    const intervalMs = options?.intervalMs ?? 200

    // ExcelJS
    if ((window as any).ExcelJS) setStatus('exceljs', 'ready')
    else setStatus('exceljs', 'loading')
    waitFor(() => !!(window as any).ExcelJS, timeoutMs, intervalMs).then((r) => setStatus('exceljs', r === 'ready' ? 'ready' : 'timeout'))

    // SheetJS / XLSX
    if ((window as any).XLSX) setStatus('sheetjs', 'ready')
    else setStatus('sheetjs', 'loading')
    waitFor(() => !!(window as any).XLSX, timeoutMs, intervalMs).then((r) => setStatus('sheetjs', r === 'ready' ? 'ready' : 'timeout'))

    // Tailwind（cdn.tailwindcss.com 会在 window.tailwind 暴露全局）
    if ((window as any).tailwind) setStatus('tailwind', 'ready')
    else setStatus('tailwind', 'loading')
    waitFor(() => !!(window as any).tailwind, timeoutMs, intervalMs).then((r) => setStatus('tailwind', r === 'ready' ? 'ready' : 'timeout'))

    // Font Awesome：优先通过 document.fonts.load 精确判断，其次根据样式表存在性
    if (isFontAwesomeReady()) setStatus('fontawesome', 'ready')
    else setStatus('fontawesome', 'loading')
        ; (async () => {
            try {
                if ((document as any).fonts && (document as any).fonts.load) {
                    const f1 = await (document as any).fonts.load('900 1em "Font Awesome 6 Free"')
                    const f2 = await (document as any).fonts.load('400 1em "Font Awesome 6 Free"')
                    const f3 = await (document as any).fonts.load('400 1em "Font Awesome 6 Brands"')
                    if ((f1 && f1.length) || (f2 && f2.length) || (f3 && f3.length)) {
                        setStatus('fontawesome', 'ready')
                        return
                    }
                }
            } catch { }
            const r = await waitFor(isFontAwesomeReady, timeoutMs, intervalMs)
            setStatus('fontawesome', r === 'ready' ? 'ready' : 'timeout')
        })()
}

// ---------------- 自动恢复（超时/错误后自动刷新或重试） ----------------

type RecoveryConfig = {
    mode?: 'reload' | 'retry' // reload: 刷新页面；retry: 仅重试注入脚本（仅兜底时可能用得上）
    maxAttempts?: number // 最大尝试次数（默认 2 次）
    delayMs?: number // 每次尝试之间的延迟（默认 1500ms）
    watchKeys?: CdnKey[] // 监听哪些 key 触发恢复（默认 ['exceljs','sheetjs','tailwind','fontawesome']）
}

const defaultRecovery: Required<RecoveryConfig> = {
    mode: 'reload',
    maxAttempts: 2,
    delayMs: 1500,
    watchKeys: ['exceljs', 'sheetjs', 'tailwind', 'fontawesome']
}

export function enableAutoRecovery(cfg?: RecoveryConfig) {
    const conf = { ...defaultRecovery, ...(cfg || {}) }
    const w = window as any
    w.__cdn_recover = w.__cdn_recover || { attempts: 0 }

    const trigger = (reason: string, key?: CdnKey) => {
        const state = w.__cdn_recover as { attempts: number }
        if (state.attempts >= conf.maxAttempts) return
        state.attempts += 1
        setTimeout(async () => {
            try {
                if (conf.mode === 'reload') {
                    location.reload()
                    return
                }
                // retry 模式：兜底重新注入关键脚本（仅在初始未通过 index.html 时有意义）
                if (key === 'exceljs' && !(w.ExcelJS)) await injectScript(CDN_EXCELJS).catch(() => { })
                if (key === 'sheetjs' && !(w.XLSX)) await injectScript(CDN_SHEETJS).catch(() => { })
                if (key === 'tailwind' && !(w.tailwind)) await injectScript(CDN_TAILWIND).catch(() => { })
                if (key === 'fontawesome' && !isFontAwesomeReady()) await injectStyle(CDN_FA).catch(() => injectStyle(CDN_FA_FALLBACK).catch(() => { }))
            } catch { }
        }, conf.delayMs)
    }

    // 监听状态变化：timeout 时触发恢复
    conf.watchKeys.forEach((k) => {
        onStatusChange(k, (s) => {
            if (s === 'timeout') trigger('timeout', k)
        })
    })

    // 监听全局脚本错误与网络错误，针对常见的超时/连接问题触发恢复
    const onResourceError = (ev: Event) => {
        const t = ev.target as any
        if (!t) return
        const src = (t.src || t.href || '') as string
        if (!src) return
        if ([CDN_EXCELJS, CDN_SHEETJS, CDN_TAILWIND, CDN_FA, CDN_FA_FALLBACK].some((u) => src.includes(u))) {
            trigger('resource-error')
        }
    }
    window.addEventListener('error', onResourceError, true)
    window.addEventListener('unhandledrejection', () => {
        // 网络未达或中断时常见在 Promise 层暴露
        trigger('unhandledrejection')
    })
}
