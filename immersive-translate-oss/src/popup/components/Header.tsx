import { Icons } from '../../components/ui/Icons'

interface HeaderProps {
    onOpenOptions: () => void
}

export function Header({ onOpenOptions }: HeaderProps) {
    return (
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
                onClick={onOpenOptions}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white"
                title="设置"
            >
                <Icons.Settings className="w-5 h-5" />
            </button>
        </div>
    )
}
