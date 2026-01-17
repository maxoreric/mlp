import { useEffect, useState } from 'react'
import { Select } from '../components/ui/Select'
import { ExtensionConfig, DEFAULT_CONFIG, TranslationServiceType } from '../types/config'
import { MessagePayload, MessageResponse } from '../types/messages'
import { Header } from './components/Header'
import { TranslationControl } from './components/TranslationControl'
import { DubbingControl } from './components/DubbingControl'
import { PdfLink } from './components/PdfLink'
import { PromptManager } from './components/PromptManager'

const SERVICE_OPTIONS: { value: TranslationServiceType; label: string }[] = [
    { value: 'google', label: 'Google 翻译 (免费)' },
    { value: 'openai', label: 'OpenAI / ChatGPT' },
    { value: 'z-ai', label: 'Z.AI (GLM-4)' },
    { value: 'zai-claude', label: 'Z.AI Claude (Coding Plan)' },
    { value: 'custom', label: '自定义 API' },
]

export default function App() {
    const [config, setConfig] = useState<ExtensionConfig>(DEFAULT_CONFIG)
    const [loading, setLoading] = useState(true)
    const [translating, setTranslating] = useState(false)

    useEffect(() => {
        loadConfig()
    }, [])

    async function loadConfig() {
        try {
            const response = await sendMessage({ action: 'GET_CONFIG' })
            if (response && response.success && response.data) {
                setConfig(response.data as ExtensionConfig)
            }
        } catch (error) {
            console.error('Failed to load config:', error)
        } finally {
            setLoading(false)
        }
    }

    async function sendMessage(payload: MessagePayload): Promise<MessageResponse> {
        return chrome.runtime.sendMessage(payload)
    }

    async function handleToggle(key: 'enabled' | 'videoSubtitle', checked: boolean) {
        let updated = { ...config }
        if (key === 'videoSubtitle') {
            updated.videoSubtitle = { ...config.videoSubtitle, enabled: checked }
        } else {
            updated.enabled = checked
        }
        setConfig(updated)
        await sendMessage({ action: 'SAVE_CONFIG', data: updated })
    }

    async function handleConfigChange(updates: Partial<ExtensionConfig>) {
        const updated = {
            ...config,
            ...updates
        }
        setConfig(updated)
        await sendMessage({ action: 'SAVE_CONFIG', data: updated })
    }

    async function handleDubbingChange(updates: Partial<any>) {
        const updated = {
            ...config,
            dubbing: { ...(config.dubbing || {}), ...updates }
        }
        setConfig(updated)
        await sendMessage({ action: 'SAVE_CONFIG', data: updated })
    }

    async function handleServiceChange(type: string) {
        const updated = {
            ...config,
            translationService: { ...config.translationService, type: type as TranslationServiceType }
        }

        if (type === 'z-ai') {
            updated.translationService.endpoint = 'https://api.z.ai/api/paas/v4/'
            updated.translationService.model = 'glm-4.7'
        }
        if (type === 'zai-claude') {
            updated.translationService.endpoint = undefined
            updated.translationService.model = 'glm-4.7'
        }

        setConfig(updated)
        await sendMessage({ action: 'SAVE_CONFIG', data: updated })
    }

    async function handleTranslatePage() {
        setTranslating(true)
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
            if (tab?.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'TRANSLATE_PAGE' })
            }
        } catch (e) {
            console.error(e)
        } finally {
            setTimeout(() => setTranslating(false), 1000)
        }
    }

    async function handleToggleDubbing() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
            if (tab?.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_DUBBING' })
            }
        } catch (e) {
            console.error('Failed to toggle dubbing:', e)
        }
    }

    function openOptions() {
        chrome.runtime.openOptionsPage()
    }

    if (loading) {
        return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div></div>
    }

    return (
        <div className="w-80 bg-slate-50 min-h-[500px] flex flex-col font-sans text-slate-800">
            <Header onOpenOptions={openOptions} />

            {/* Main Content */}
            <div className="flex-1 p-5 space-y-5 overflow-y-auto">
                <TranslationControl
                    enabled={config.enabled}
                    translating={translating}
                    onToggle={(checked) => handleToggle('enabled', checked)}
                    onTranslate={handleTranslatePage}
                />

                <DubbingControl
                    enabled={!!config.videoSubtitle?.enabled}
                    onToggle={(checked) => handleToggle('videoSubtitle', checked)}
                    onToggleDubbing={handleToggleDubbing}
                />

                <PdfLink />
            </div>

            {/* Footer with Configuration Controls */}
            <div className="px-6 py-5 border-t border-slate-100 bg-white space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">目标语言</label>
                        <Select
                            value={config.targetLang}
                            onChange={(val) => handleConfigChange({ targetLang: val })}
                            options={[
                                { value: 'zh-CN', label: '简体中文' },
                                { value: 'en', label: 'English' },
                                { value: 'ja', label: '日本語' },
                                { value: 'ko', label: '한국어' }
                            ]}
                            className="w-full text-xs font-medium"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">配音引擎</label>
                        <Select
                            value={config.dubbing?.engine || 'browser'}
                            onChange={(val) => handleDubbingChange({ engine: val as any })}
                            options={[
                                { value: 'browser', label: 'Web Speech' },
                                { value: 'piper', label: 'Piper TTS' }
                            ]}
                            className="w-full text-xs font-medium"
                        />
                    </div>
                </div>

                <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">翻译服务</label>
                    <Select
                        value={config.translationService.type}
                        onChange={handleServiceChange}
                        options={SERVICE_OPTIONS}
                        className="w-full text-xs font-medium"
                    />
                </div>

                {/* Prompt Manager (Only for AI services) */}
                {['openai', 'z-ai', 'zai-claude', 'custom'].includes(config.translationService.type) && (
                    <PromptManager
                        customPrompts={config.customPrompts || []}
                        activePromptId={config.activePromptId || 'default-normal'}
                        onSave={(prompts) => handleConfigChange({ customPrompts: prompts })}
                        onSelectActive={(id) => handleConfigChange({ activePromptId: id })}
                    />
                )}

                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">每次请求段落数 (Batch Size)</label>
                        <span className="text-[10px] text-slate-400">{config.requestBatchSize || 30}</span>
                    </div>
                    <input
                        type="range"
                        min="5"
                        max="100"
                        step="5"
                        value={config.requestBatchSize || 30}
                        onChange={(e) => handleConfigChange({ requestBatchSize: parseInt(e.target.value) })}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <p className="text-[10px] text-slate-400">设置过大可能导致超时，建议值: 20-50</p>
                </div>

                {/* Advanced Translation Settings */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2">高级设置</label>

                    {/* Retries */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                            <div className="flex justify-between">
                                <span className="text-[10px] text-slate-500">重试次数</span>
                                <span className="text-[10px] text-slate-400">{config.maxRetries ?? 3}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="5"
                                value={config.maxRetries ?? 3}
                                onChange={(e) => handleConfigChange({ maxRetries: parseInt(e.target.value) })}
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between">
                                <span className="text-[10px] text-slate-500">重试延迟 (ms)</span>
                                <span className="text-[10px] text-slate-400">{config.retryDelay ?? 1000}</span>
                            </div>
                            <input
                                type="range"
                                min="100"
                                max="5000"
                                step="100"
                                value={config.retryDelay ?? 1000}
                                onChange={(e) => handleConfigChange({ retryDelay: parseInt(e.target.value) })}
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>
                    </div>

                    {/* API Endpoint & Model Override */}
                    {(['openai', 'z-ai', 'zai-claude', 'custom'].includes(config.translationService.type)) && (
                        <div className="space-y-2 mt-2">
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1">API Endpoint (可选)</label>
                                <input
                                    type="text"
                                    placeholder="默认使用官方端点"
                                    value={config.translationService.endpoint || ''}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        const updatedService = { ...config.translationService, endpoint: val ? val : undefined }
                                        handleConfigChange({ translationService: updatedService })
                                    }}
                                    className="w-full text-xs px-2 py-1 border border-slate-200 rounded focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1">模型名称 (Model)</label>
                                <input
                                    type="text"
                                    placeholder="例如: gpt-3.5-turbo, glm-4"
                                    value={config.translationService.model || ''}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        const updatedService = { ...config.translationService, model: val ? val : undefined }
                                        handleConfigChange({ translationService: updatedService })
                                    }}
                                    className="w-full text-xs px-2 py-1 border border-slate-200 rounded focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* Reset Floating Ball */}
                    <button
                        onClick={() => handleConfigChange({ floatingBall: { position: { x: -1, y: -1 } } })}
                        className="w-full mt-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                    >
                        重置悬浮球位置
                    </button>
                </div>
            </div>
        </div>
    )
}
