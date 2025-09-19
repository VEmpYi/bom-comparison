import { COLORS } from '../constants'

export function normalizeKey(key: any) {
    if (key == null) return '' //  如果键为null或undefined，返回空字符串
    let s = String(key) //  将键转换为字符串
    s = s.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '') //  移除零宽字符（包括零宽空格、零宽连字等）和软连字符
    s = s.replace(/[\s\u00A0]+/g, '').trim() //  移除所有空白字符（包括普通空格和不换行空格）并去除首尾空格
    return s //  返回处理后的字符串
}

export function naturalCompare(a: string, b: string) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'accent' }) //  使用localeCompare方法对两个字符串进行比较 a和b是要比较的两个字符串参数 undefined表示使用系统的默认语言环境 numeric: true 启用数字排序，例如"2"会排在"10"前面 sensitivity: 'accent' 表示考虑重音符号的差异，例如"é"和"e"被视为不同
}

// 颜色优先级映射工具（ARGB）
export const ColorPriority = {
    [COLORS.LIGHT_RED]: 0,
    [COLORS.ORANGE]: 1,
    [COLORS.LIGHT_BLUE]: 2,
    [COLORS.LIGHT_GREEN]: 3,
} as const

export function colorToPriority(argb?: string): number {
    if (!argb) return 4
    return (ColorPriority as any)[argb] ?? 4
}

// 通用：按颜色优先、同色内按 PN 自然排序
export function sortByColorThenPN<T extends { colorCategory?: string; data?: Record<string, any> }>(rows: T[], pnKey = '零件号'): T[] {
    const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })
    return [...rows].sort((a, b) => {
        const pa = colorToPriority(a.colorCategory as string)
        const pb = colorToPriority(b.colorCategory as string)
        if (pa !== pb) return pa - pb
        const apn = String(a?.data?.[pnKey] ?? '').trim()
        const bpn = String(b?.data?.[pnKey] ?? '').trim()
        return collator.compare(apn, bpn)
    })
}
