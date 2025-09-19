import { createApp } from 'vue'
import App from './App.vue'
import { initCdnStatusWatch, loadCDNs, enableAutoRecovery } from './services/cdn'

// 立即创建并挂载Vue应用，不等待CDN资源
const app = createApp(App)
app.mount('#app')

    // 异步初始化CDN状态监控，不阻塞应用启动
    ; (async () => {
        try {
            // 启动CDN状态监控
            await initCdnStatusWatch({ timeoutMs: 15000 })
            // 启用自动恢复机制
            enableAutoRecovery({
                mode: 'reload',
                maxAttempts: 2,
                delayMs: 2000
            })
            // 如果某些CDN资源未加载，尝试兜底加载
            setTimeout(async () => {
                const g = window as any
                if (!g.ExcelJS || !g.XLSX || !g.tailwind) {
                    console.log('检测到部分CDN资源未加载，正在进行兜底加载...')
                    try {
                        await loadCDNs()
                    } catch (error) {
                        console.warn('兜底CDN加载失败:', error)
                    }
                }
            }, 3000) // 3秒后检查

        } catch (error) {
            console.warn('CDN初始化失败:', error)
        }
    })()
