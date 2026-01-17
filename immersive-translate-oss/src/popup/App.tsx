import { useEffect, useState } from 'react'
import { Switch } from '../components/ui/Switch'
import { Icons } from '../components/ui/Icons'
import { Select } from '../components/ui/Select'
import { ExtensionConfig, DEFAULT_CONFIG, TranslationServiceType } from '../types/config'
import { MessagePayload, MessageResponse } from '../types/messages'

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
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-sky-500 to-indigo-600 shadow-lg z-10 text-white">
                <div className="flex items-center space-x-3">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                        <Icons.Globe className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight tracking-tight">Immersive</h1>
                        <p className="text-[10px] text-sky-100 font-medium tracking-wider opacity-90">TRANSLATE OSS</p>
                    </div>
                </div>
                <button
                    onClick={openOptions}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white"
                    title="设置"
                >
                    <Icons.Settings className="w-5 h-5" />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-5 space-y-5 overflow-y-auto">
                {/* Main Toggle Card */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <div className={`relative flex h-3 w-3`}>
                                {config.enabled && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-3 w-3 ${config.enabled ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                            </div>
                            <span className="font-semibold text-slate-700">网页翻译</span>
                        </div>
                        <Switch checked={config.enabled} onChange={(checked) => handleToggle('enabled', checked)} />
                    </div>

                    <button
                        onClick={handleTranslatePage}
                        disabled={!config.enabled || translating}
                        className="w-full py-3 bg-slate-50 text-sky-600 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl text-sm transition-all flex items-center justify-center space-x-2 border border-slate-100/50"
                    >
                        {translating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                <span>翻译中...</span>
                            </>
                        ) : (
                            <>
                                <Icons.Translate className="w-4 h-4" />
                                <span>翻译当前页面</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Video Subtitle Card */}
                <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-5 shadow-lg text-white group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 transform group-hover:scale-110 transition-transform duration-500">
                        <Icons.Video className="w-24 h-24" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-2">
                                <span className="bg-indigo-500/20 text-indigo-300 p-1.5 rounded-lg">
                                    <Icons.Video className="w-4 h-4" />
                                </span>
                                <span className="font-semibold text-sm tracking-wide">视频增强</span>
                            </div>
                            <Switch
                                checked={!!config.videoSubtitle?.enabled}
                                onChange={(checked) => handleToggle('videoSubtitle', checked)}
                                className="brightness-110"
                            />
                        </div>

                        <p className="text-xs text-slate-400 mb-4 font-normal leading-relaxed">
                            为 YouTube 和 Bilibili 提供实时双语字幕与 AI 配音。
                        </p>

                        {/* Dubbing Toggle Button */}
                        <button
                            onClick={handleToggleDubbing}
                            disabled={!config.videoSubtitle?.enabled}
                            className={`w-full py-2.5 text-xs font-medium rounded-xl transition-all flex items-center justify-center space-x-2 border 
                                ${config.videoSubtitle?.enabled
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent shadow-lg shadow-indigo-900/20'
                                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'}`}
                        >
                            <Icons.Volume className="w-3.5 h-3.5" />
                            <span>启用 AI 配音</span>
                        </button>
                    </div>
                </div>

                {/* PDF Reader Entry */}
                <button
                    onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('pdf/index.html') })}
                    className="w-full bg-white hover:bg-orange-50/50 text-slate-700 p-4 rounded-2xl shadow-sm border border-slate-100 transition-all flex items-center justify-between group hover:shadow-md hover:border-orange-100"
                >
                    <div className="flex items-center space-x-4">
                        <div className="bg-orange-100 text-orange-600 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                            <Icons.FileText className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <div className="font-semibold text-sm text-slate-800">PDF 阅读器</div>
                            <div className="text-xs text-slate-500">本地文件双语对照</div>
                        </div>
                    </div>
                    <Icons.ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-orange-400 transition-colors" />
                </button>
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
            </div>
        </div>
    )
}
