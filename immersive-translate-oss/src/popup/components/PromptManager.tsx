import { useState } from 'react'
import { PromptTemplate } from '../../types/config'
import { Select } from '../../components/ui/Select'
import { DEFAULT_PROMPTS } from '../../services/translator/prompts'

interface PromptManagerProps {
    customPrompts: PromptTemplate[]
    activePromptId: string
    onSave: (prompts: PromptTemplate[]) => void
    onSelectActive: (id: string) => void
}

export function PromptManager({ customPrompts, activePromptId, onSave, onSelectActive }: PromptManagerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editPrompt, setEditPrompt] = useState<PromptTemplate | null>(null)

    // Combined list for selection
    const allPrompts = [...DEFAULT_PROMPTS, ...customPrompts]

    const handleEdit = (prompt?: PromptTemplate) => {
        if (prompt) {
            setEditPrompt({ ...prompt })
        } else {
            // New prompt
            setEditPrompt({
                id: crypto.randomUUID(),
                name: 'New Prompt',
                type: 'normal',
                system: 'You are a professional translator...'
            })
        }
        setIsEditing(true)
    }

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this prompt?')) {
            const updated = customPrompts.filter(p => p.id !== id)
            onSave(updated)
            if (activePromptId === id) {
                onSelectActive('default-normal')
            }
        }
    }

    const handleSavePrompt = () => {
        if (!editPrompt) return

        if (!editPrompt.name.trim() || !editPrompt.system.trim()) {
            alert('Name and System Prompt are required')
            return
        }

        const existingIndex = customPrompts.findIndex(p => p.id === editPrompt.id)
        let updated
        if (existingIndex >= 0) {
            updated = [...customPrompts]
            updated[existingIndex] = editPrompt
        } else {
            updated = [...customPrompts, editPrompt]
        }

        onSave(updated)
        setIsEditing(false)
        setEditPrompt(null)
    }

    return (
        <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Translation Style (Prompt)
                </label>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="text-[10px] text-indigo-500 hover:text-indigo-600 font-medium"
                >
                    {isOpen ? 'Close Manager' : 'Manage Prompts'}
                </button>
            </div>

            {/* Active Prompt Selector */}
            <Select
                value={activePromptId}
                onChange={onSelectActive}
                options={allPrompts.map(p => ({
                    value: p.id,
                    label: `${p.name} (${p.type})`
                }))}
                className="w-full text-xs font-medium"
            />

            {/* Manager UI */}
            {isOpen && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mt-2 space-y-3">
                    {!isEditing ? (
                        <>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {customPrompts.length === 0 && (
                                    <p className="text-xs text-slate-400 text-center py-2">No custom prompts</p>
                                )}
                                {customPrompts.map(p => (
                                    <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded border border-slate-100">
                                        <span className="text-xs font-medium truncate flex-1">{p.name}</span>
                                        <div className="flex gap-2 ml-2">
                                            <button
                                                onClick={() => handleEdit(p)}
                                                className="text-[10px] text-slate-500 hover:text-indigo-600"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(p.id)}
                                                className="text-[10px] text-red-400 hover:text-red-500"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => handleEdit()}
                                className="w-full py-1.5 text-xs text-center border border-dashed border-slate-300 rounded text-slate-500 hover:bg-white hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                            >
                                + Add New Prompt
                            </button>
                        </>
                    ) : (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase text-slate-400">Name</label>
                                <input
                                    type="text"
                                    value={editPrompt?.name || ''}
                                    onChange={e => setEditPrompt(prev => prev ? { ...prev, name: e.target.value } : null)}
                                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:border-indigo-500 outline-none"
                                    placeholder="e.g. Academic Style"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase text-slate-400">Type</label>
                                <Select
                                    value={editPrompt?.type || 'normal'}
                                    onChange={val => setEditPrompt(prev => prev ? { ...prev, type: val as any } : null)}
                                    options={[
                                        { value: 'normal', label: 'Normal (Line-by-Line)' },
                                        { value: 'sense', label: 'Sense Mode (Structure Analyzed)' }
                                    ]}
                                    className="w-full text-xs"
                                />
                                <p className="text-[10px] text-slate-400">
                                    {editPrompt?.type === 'normal'
                                        ? 'Standard translation, one line per input.'
                                        : 'Advanced mode. Requires specific JSON array output format.'}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase text-slate-400">System Prompt</label>
                                <textarea
                                    value={editPrompt?.system || ''}
                                    onChange={e => setEditPrompt(prev => prev ? { ...prev, system: e.target.value } : null)}
                                    className="w-full h-24 text-xs px-2 py-1.5 border border-slate-200 rounded focus:border-indigo-500 outline-none resize-none font-mono"
                                    placeholder="You are a translator..."
                                />
                                <div className="text-[9px] text-slate-400 flex gap-2">
                                    <span>Variables: {'${source}'}, {'${target}'}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={handleSavePrompt}
                                    className="flex-1 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 font-medium"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => { setIsEditing(false); setEditPrompt(null) }}
                                    className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-xs rounded hover:bg-slate-200"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
