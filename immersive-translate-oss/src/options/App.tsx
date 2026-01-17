import { useState, useEffect } from 'react'
import { Layout } from '../components/Layout'
import { ExtensionConfig, DEFAULT_CONFIG, TranslationServiceType } from '../types/config'

import VideoSettings from './VideoSettings'
import { Icons } from '../components/ui/Icons'
import { Select } from '../components/ui/Select'

const SERVICE_OPTIONS: { value: TranslationServiceType; label: string }[] = [
    { value: 'google', label: 'Google 翻译 (免费)' },
    { value: 'openai', label: 'OpenAI / ChatGPT' },
    { value: 'z-ai', label: 'Z.AI (GLM-4)' },
    { value: 'zai-claude', label: 'Z.AI Claude (Coding Plan)' },
    { value: 'custom', label: '自定义 API (GLM/DeepSeek等)' },
]

export default function App() {
    const [activeTab, setActiveTab] = useState('general')
    const [config, setConfig] = useState<ExtensionConfig>(DEFAULT_CONFIG)
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    useEffect(() => {
        loadConfig()
    }, [])

    async function loadConfig() {
        console.log('[Options] Loading config...')
        try {
            const response = await chrome.runtime.sendMessage({ action: 'GET_CONFIG' })
            console.log('[Options] Config loaded:', response.data)
            if (response && response.success && response.data) {
                setConfig(response.data as ExtensionConfig)
            }
        } catch (error) {
            console.error('Failed to load config:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleSave(newConfig: ExtensionConfig) {
        console.log('[Options] Saving config:', newConfig)
        setMessage(null)
        setConfig(newConfig) // Optimistic update
        try {
            const response = await chrome.runtime.sendMessage({ action: 'SAVE_CONFIG', data: newConfig })
            if (response && response.success) {
                setMessage({ type: 'success', text: '设置已保存' })
                setTimeout(() => setMessage(null), 3000)
            } else {
                setMessage({ type: 'error', text: response?.error || '保存失败' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: '保存失败' })
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-gray-500 font-medium">Loading settings...</div>
                </div>
            </div>
        )
    }

    return (
        <Layout activeTab={activeTab} onTabChange={setActiveTab}>
            {activeTab === 'general' && (
                <GeneralSettings
                    config={config}
                    onSave={handleSave}
                    message={message}
                />
            )}
            {activeTab === 'video' && (
                <VideoSettings
                    config={config}
                    onSave={handleSave}
                />
            )}
            {activeTab === 'developer' && <DeveloperSettings />}
        </Layout>
    )
}

interface SettingsProps {
    config: ExtensionConfig
    onSave: (config: ExtensionConfig) => void
    message?: { type: 'success' | 'error'; text: string } | null
}

function GeneralSettings({ config, onSave, message }: SettingsProps) {
    function updateService(updates: Partial<ExtensionConfig['translationService']>) {
        let newService = { ...config.translationService, ...updates }

        // Auto-configure for Z.AI preset
        if (updates.type === 'z-ai') {
            newService.endpoint = 'https://api.z.ai/api/paas/v4/'
            newService.model = 'glm-4.7'
        }

        // Auto-configure for Z.AI Claude (Coding Plan)
        if (updates.type === 'zai-claude') {
            newService.endpoint = undefined
            newService.model = 'glm-4.7'
        }

        onSave({
            ...config,
            translationService: newService,
        })
    }

    const showApiConfig = config.translationService.type !== 'google'

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <Icons.Settings className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">常规设置</h2>
                        <p className="text-sm text-gray-500 mt-1">管理翻译服务和语言偏好</p>
                    </div>
                </div>
                {message && (
                    <div className={`px-4 py-2 rounded-lg text-sm font-medium animate-slide-in ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                        {message.text}
                    </div>
                )}
            </div>

            <div className="grid gap-6">
                {/* Translation Service Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-semibold text-gray-900">翻译服务配置</h3>
                    </div>
                    <div className="p-6 space-y-6">
                        <Select
                            label="选择翻译服务"
                            value={config.translationService.type}
                            onChange={(val) => updateService({ type: val as TranslationServiceType })}
                            options={SERVICE_OPTIONS}
                        />

                        {showApiConfig && (
                            <div className="space-y-4 pt-4 border-t border-gray-100 animate-slide-down">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                    <input
                                        type="password"
                                        value={config.translationService.apiKey || ''}
                                        onChange={(e) => updateService({ apiKey: e.target.value })}
                                        placeholder="sk-..."
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow outline-none"
                                    />
                                </div>

                                {(config.translationService.type === 'custom' || config.translationService.type === 'z-ai') && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">API Endpoint</label>
                                            <input
                                                type="text"
                                                value={config.translationService.endpoint || ''}
                                                onChange={(e) => updateService({ endpoint: e.target.value })}
                                                placeholder="https://api.example.com/v1"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                                                disabled={config.translationService.type === 'z-ai'}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Model Name</label>
                                            <input
                                                type="text"
                                                value={config.translationService.model || ''}
                                                onChange={(e) => updateService({ model: e.target.value })}
                                                placeholder="gpt-3.5-turbo"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                                                disabled={config.translationService.type === 'z-ai'}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Visual Style Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-semibold text-gray-900">显示样式</h3>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {(['block', 'underline', 'blur', 'sense'] as const).map((style) => (
                                <button
                                    key={style}
                                    onClick={() => onSave({ ...config, displayStyle: style })}
                                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${config.displayStyle === style
                                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded-full border mb-3 flex items-center justify-center ${config.displayStyle === style ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                                        }`}>
                                        {config.displayStyle === style && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                    <div className="font-semibold text-sm">
                                        {style === 'block' ? '对照模式' : style === 'underline' ? '下划线' : style === 'blur' ? '模糊模式' : '意群对照'}
                                    </div>
                                    <div className="text-xs mt-1 opacity-70">
                                        {style === 'block' ? '默认推荐' : style === 'sense' ? 'AI 智能增强' : '辅助阅读'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function DeveloperSettings() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center space-x-4 mb-8">
                <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                    <Icons.Code className="w-8 h-8 text-purple-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">开发者选项</h2>
                    <p className="text-sm text-gray-500 mt-1">调试与高级配置</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Environment Info</h3>
                <pre className="text-xs font-mono text-gray-600 bg-gray-50 p-4 rounded-lg overflow-auto border border-gray-100">
                    User Agent: {navigator.userAgent}{'\n'}
                    Language: {navigator.language}{'\n'}
                    Platform: {navigator.platform}
                </pre>
            </div>
        </div>
    )
}
