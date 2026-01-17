import { Switch } from '../../components/ui/Switch'
import { Icons } from '../../components/ui/Icons'

interface DubbingControlProps {
    enabled: boolean
    onToggle: (checked: boolean) => void
    onToggleDubbing: () => void
}

export function DubbingControl({ enabled, onToggle, onToggleDubbing }: DubbingControlProps) {
    return (
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
                        checked={enabled}
                        onChange={onToggle}
                        className="brightness-110"
                    />
                </div>

                <p className="text-xs text-slate-400 mb-4 font-normal leading-relaxed">
                    为 YouTube 和 Bilibili 提供实时双语字幕与 AI 配音。
                </p>

                {/* Dubbing Toggle Button */}
                <button
                    onClick={onToggleDubbing}
                    disabled={!enabled}
                    className={`w-full py-2.5 text-xs font-medium rounded-xl transition-all flex items-center justify-center space-x-2 border 
                        ${enabled
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent shadow-lg shadow-indigo-900/20'
                            : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'}`}
                >
                    <Icons.Volume className="w-3.5 h-3.5" />
                    <span>启用 AI 配音</span>
                </button>
            </div>
        </div>
    )
}
