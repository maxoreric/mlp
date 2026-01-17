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
        <div className="w-80 bg-gray-50 min-h-[400px] flex flex-col font-sans">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-white shadow-sm z-10">
                <div className="flex items-center space-x-2">
                    <div className="bg-primary-50 text-primary-600 p-1.5 rounded-lg">
                        <Icons.Globe className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-gray-900 tracking-tight">Immersive</span>
                </div>
                <button
                    onClick={openOptions}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                    title="设置"
                >
                    <Icons.Settings className="w-5 h-5" />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-5 space-y-5 overflow-y-auto">
                {/* Main Toggle Card */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-gray-300'}`}></div>
                            <span className="font-medium text-gray-700">网页翻译</span>
                        </div>
                        <Switch checked={config.enabled} onChange={(checked) => handleToggle('enabled', checked)} />
                    </div>

                    <button
                        onClick={handleTranslatePage}
                        disabled={!config.enabled || translating}
                        className="w-full mt-2 py-2.5 bg-primary-50 text-primary-600 hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium rounded-lg text-sm transition-colors flex items-center justify-center space-x-2"
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
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 shadow-lg text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Icons.Video className="w-16 h-16" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                                <Icons.Video className="w-4 h-4 text-primary-400" />
                                <span className="font-semibold text-sm tracking-wide">视频字幕增强</span>
                            </div>
                            <span className="bg-primary-500/20 text-primary-300 text-[10px] px-1.5 py-0.5 rounded border border-primary-500/30">
                                PRO
                            </span>
                        </div>

                        <p className="text-xs text-gray-400 mb-3">
                            支持 YouTube, Bilibili 双语字幕实时翻译
                        </p>

                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-medium text-gray-300">
                                {config.videoSubtitle?.enabled ? '已开启' : '已关闭'}
                            </span>
                            <div>
                                <Switch
                                    checked={!!config.videoSubtitle?.enabled}
                                    onChange={(checked) => handleToggle('videoSubtitle', checked)}
                                    className="brightness-110"
                                />
                            </div>
                        </div>

                        {/* Dubbing Toggle Button */}
                        <button
                            onClick={handleToggleDubbing}
                            disabled={!config.videoSubtitle?.enabled}
                            className="w-full py-2 bg-primary-500/20 hover:bg-primary-500/30 text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium rounded-lg transition-colors flex items-center justify-center space-x-2 border border-primary-500/30"
                        >
                            <Icons.Volume className="w-3.5 h-3.5" />
                            <span>语音配音</span>
                        </button>
                    </div>
                </div>
                {/* PDF Reader Entry */}
                <button
                    onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('pdf/index.html') })}
                    className="w-full bg-white hover:bg-gray-50 text-gray-700 p-4 rounded-xl shadow-sm border border-gray-100 transition-colors flex items-center justify-between group"
                >
                    <div className="flex items-center space-x-3">
                        <div className="bg-orange-50 text-orange-600 p-2 rounded-lg group-hover:bg-orange-100 transition-colors">
                            <Icons.FileText className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <div className="font-semibold text-sm text-gray-900">PDF 阅读器</div>
                            <div className="text-xs text-gray-500">双语对照翻译本地 PDF</div>
                        </div>
                    </div>
                    <Icons.ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                </button>
            </div>

            {/* Footer with Configuration Controls */}
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 space-y-3">

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <div className="mb-1 text-xs text-gray-500 font-medium ml-1">目标语言</div>
                        <Select
                            value={config.targetLang}
                            onChange={(val) => handleConfigChange({ targetLang: val })}
                            options={[
                                { value: 'zh-CN', label: '简体中文' },
                                { value: 'en', label: 'English' },
                                { value: 'ja', label: '日本語' },
                                { value: 'ko', label: '한국어' }
                            ]}
                            className="w-full text-xs"
                        />
                    </div>
                    <div>
                        <div className="mb-1 text-xs text-gray-500 font-medium ml-1">配音引擎</div>
                        <Select
                            value={config.dubbing?.engine || 'browser'}
                            onChange={(val) => handleDubbingChange({ engine: val as any })}
                            options={[
                                { value: 'browser', label: 'Web Speech' },
                                { value: 'piper', label: 'Piper TTS' }
                            ]}
                            className="w-full text-xs"
                        />
                    </div>
                </div>

                <div>
                    <div className="mb-1 text-xs text-gray-500 font-medium ml-1">翻译服务</div>
                    <Select
                        value={config.translationService.type}
                        onChange={handleServiceChange}
                        options={SERVICE_OPTIONS}
                        className="w-full text-xs"
                    />
                </div>
            </div>
        </div>
    )
}
