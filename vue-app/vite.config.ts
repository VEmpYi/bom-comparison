import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig(({ mode }) => {
    // 读取环境变量（如需）
    // 避免对 Node.js 全局的类型依赖，直接使用根路径 '.'
    const env = loadEnv(mode, '.', '')
    // 默认构建为单文件，除非明确指定为多文件模式
    const isSingle = mode !== 'multifile'

    return {
        plugins: [
            vue(),
            // 单文件模式：将产物合并为一个 HTML
            ...(isSingle ? [viteSingleFile()] : [])
        ],
        build: {
            // 单文件模式下尽量把资源全部内联
            assetsInlineLimit: isSingle ? 10_000_000 : 4096,
            cssCodeSplit: !isSingle,
            chunkSizeWarningLimit: 2000,
            rollupOptions: {
                // 在单文件模式下，把 vue 标记为 external，避免被打包进产物，
                // 浏览器将通过 import map 从 CDN 解析它。
                external: isSingle ? ['vue'] : [],
                output: {
                    // 单文件模式下避免拆分chunks
                    manualChunks: isSingle ? undefined : {
                        vendor: ['vue']
                    }
                }
            }
        },
        server: {
            host: true,
            port: parseInt(env.PORT || '', 10) || 5173
        }
    }
})
