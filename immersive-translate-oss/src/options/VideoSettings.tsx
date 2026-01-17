import { Switch } from '../components/ui/Switch'
import { Slider } from '../components/ui/Slider'
import { Select } from '../components/ui/Select'
import { ExtensionConfig } from '../types/config'
import { DEFAULT_DUBBING_OPTIONS } from '../content/video/dubbing/types'

interface VideoSettingsProps {
    config: ExtensionConfig
    onSave: (config: ExtensionConfig) => void
}

export default function VideoSettings({ config, onSave }: VideoSettingsProps) {
    const { videoSubtitle } = config

    // Ensure videoSubtitle exists, fallback to default if not (for migration safety)
    const settings = videoSubtitle || {
        enabled: true,
        fontSize: 20,
        opacity: 0.8,
        color: '#FFFFFF',
        backgroundColor: '#000000',
    }

    const updateSettings = (updates: Partial<typeof settings>) => {
        onSave({
            ...config,
            videoSubtitle: { ...settings, ...updates }
        })
    }

    const fontColors = [
        { value: '#FFFFFF', label: '白色' },
        { value: '#FFFF00', label: '黄色' },
        { value: '#00FF00', label: '绿色' },
        { value: '#00FFFF', label: '青色' },
    ]

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">视频字幕</h2>
                    <p className="text-gray-500 mt-1">自定义视频双语字幕的显示样式</p>
                </div>
                <Switch
                    checked={settings.enabled}
                    onChange={(checked) => updateSettings({ enabled: checked })}
                    label={settings.enabled ? "已开启" : "已关闭"}
                />
            </div>

            {/* Live Preview - Premium Feature */}
            <div className="bg-gray-900 rounded-xl overflow-hidden shadow-lg aspect-video relative group">
                {/* Mock Video content/background */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <span className="text-gray-700 font-bold text-4xl select-none opacity-20">VIDEO PREVIEW</span>
                </div>

                {/* Subtitle Overlay Preview */}
                <div className="absolute bottom-10 left-0 right-0 text-center px-8 transition-all duration-300">
                    <div
                        className="inline-block px-4 py-2 rounded transition-all duration-200"
                        style={{
                            fontSize: `${settings.fontSize}px`,
                            color: settings.color,
                            backgroundColor: `rgba(${parseInt(settings.backgroundColor.slice(1, 3), 16)}, ${parseInt(settings.backgroundColor.slice(3, 5), 16)}, ${parseInt(settings.backgroundColor.slice(5, 7), 16)}, ${settings.opacity})`,
                            textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                        }}
                    >
                        Never gonna give you up
                    </div>
                    <div
                        className="mt-2 text-sm text-gray-300"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                    >
                        决不放弃你
                    </div>
                </div>
            </div>

            {/* Settings Controls */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 transition-opacity duration-300 ${settings.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div className="space-y-6">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">外观</h3>

                    <Select
                        label="字体颜色"
                        value={settings.color}
                        onChange={(val) => updateSettings({ color: val })}
                        options={fontColors}
                    />

                    <Select
                        label="背景颜色"
                        value={settings.backgroundColor}
                        onChange={(val) => updateSettings({ backgroundColor: val })}
                        options={[
                            { value: '#000000', label: '黑色' },
                            { value: '#FFFFFF', label: '白色' },
                            { value: '#0000FF', label: '蓝色' },
                        ]}
                    />

                    <Slider
                        label="背景透明度"
                        value={settings.opacity}
                        onChange={(val) => updateSettings({ opacity: val })}
                        min={0}
                        max={1}
                        step={0.1}
                        formatValue={(v) => `${Math.round(v * 100)}%`}
                    />
                </div>

                <div className="space-y-6">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">排版</h3>

                    <Slider
                        label="字号大小"
                        value={settings.fontSize}
                        onChange={(val) => updateSettings({ fontSize: val })}
                        min={12}
                        max={40}
                        step={1}
                        formatValue={(v) => `${v}px`}
                    />
                </div>
                <div className="space-y-6">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">配音设置</h3>

                    <Switch
                        checked={config.dubbing?.enabled ?? DEFAULT_DUBBING_OPTIONS.enabled}
                        onChange={(checked) => onSave({
                            ...config,
                            dubbing: { ...(config.dubbing || DEFAULT_DUBBING_OPTIONS), enabled: checked }
                        })}
                        label="启用语音配音"
                    />

                    <Select
                        label="合成引擎"
                        value={config.dubbing?.engine ?? DEFAULT_DUBBING_OPTIONS.engine}
                        onChange={(val) => onSave({
                            ...config,
                            dubbing: { ...(config.dubbing || DEFAULT_DUBBING_OPTIONS), engine: val as any }
                        })}
                        options={[
                            { value: 'browser', label: '浏览器原生 (Web Speech)' },
                            { value: 'piper', label: 'Piper TTS (本地离线)' },
                        ]}
                    />

                    <Slider
                        label="原声音量 (闪避)"
                        value={config.dubbing?.originalVolumeLevel ?? DEFAULT_DUBBING_OPTIONS.originalVolumeLevel}
                        onChange={(val) => onSave({
                            ...config,
                            dubbing: { ...(config.dubbing || DEFAULT_DUBBING_OPTIONS), originalVolumeLevel: val }
                        })}
                        min={0}
                        max={1}
                        step={0.1}
                        formatValue={(v) => `${Math.round(v * 100)}%`}
                    />
                </div>
            </div>
        </div>
    )
}
