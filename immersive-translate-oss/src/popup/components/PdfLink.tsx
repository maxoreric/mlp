import { Icons } from '../../components/ui/Icons'

export function PdfLink() {
    return (
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
    )
}
