import { Switch } from '../../components/ui/Switch'
import { Icons } from '../../components/ui/Icons'

interface TranslationControlProps {
    enabled: boolean
    translating: boolean
    onToggle: (checked: boolean) => void
    onTranslate: () => void
}

export function TranslationControl({ enabled, translating, onToggle, onTranslate }: TranslationControlProps) {
    return (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <div className={`relative flex h-3 w-3`}>
                        {enabled && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${enabled ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                    </div>
                    <span className="font-semibold text-slate-700">网页翻译</span>
                </div>
                <Switch checked={enabled} onChange={onToggle} />
            </div>

            <button
                onClick={onTranslate}
                disabled={!enabled || translating}
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
    )
}
