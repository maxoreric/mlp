import { ExtensionConfig, PromptTemplate } from '@/types/config'

export const DEFAULT_PROMPTS: PromptTemplate[] = [
    {
        id: 'default-normal',
        name: 'Default (Professional)',
        type: 'normal',
        system: `You are a professional translator. Translate the following texts from \${source} to \${target}. 
Output exactly ONE TRANSLATED LINE per input text. 
Output in the same order as input. No extra text or explanations.`
    },
    {
        id: 'default-sense',
        name: 'Sense Mode (Tutor)',
        type: 'sense',
        system: `You are an expert language tutor. Analyze the following text.
1. Split each sentence into logical sense groups based heavily on PREPOSITIONS and conjunctions.
2. Translate each group into \${target}.
3. For EACH input sentence, output exactly ONE line of JSON: [{"src": "source_part", "tgt": "translated_part"}, ...]
4. Output lines in the same order as input. STRICT JSON.`
    }
]

/**
 * Resolve the active prompt wrapper based on config and mode.
 * 
 * Logic:
 * 1. If mode is 'sense', finding an active prompt is tricky because usually "Active Prompt" 
 *    in UI refers to the general translation style.
 *    However, if the user explicitly selected a *custom* Sense prompt as active, we should use it.
 * 2. If mode is 'normal', use the active prompt if it is of type 'normal'.
 * 3. Fallback to defaults if no matching active prompt is found.
 */
export function getActivePrompt(config: ExtensionConfig, mode: 'normal' | 'sense'): PromptTemplate {
    const allPrompts = [...DEFAULT_PROMPTS, ...config.customPrompts]
    const active = allPrompts.find(p => p.id === config.activePromptId)

    // Robust Fallback Logic

    // Case 1: We are in Sense Mode (e.g. user toggled "Bilingual Contrast" or specific feature)
    if (mode === 'sense') {
        // If the user explicitly activated a Sense prompt, use it.
        if (active && active.type === 'sense') {
            return active
        }
        // Otherwise, simply find the default sense prompt (or the first available sense prompt)
        return allPrompts.find(p => p.id === 'default-sense') || allPrompts.find(p => p.type === 'sense') || DEFAULT_PROMPTS[1]
    }

    // Case 2: Normal Mode
    if (active && active.type === 'normal') {
        return active
    }

    // Fallback to default normal
    return allPrompts.find(p => p.id === 'default-normal') || DEFAULT_PROMPTS[0]
}

/**
 * Helper to interpolate variables into the system prompt.
 * Supported vars: ${source}, ${target}
 */
export function renderPrompt(template: string, sourceLang: string, targetLang: string): string {
    return template
        .replace(/\$\{source\}/g, sourceLang || 'auto')
        .replace(/\$\{target\}/g, targetLang)
}
