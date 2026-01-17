/**
 * Storage wrapper for chrome.storage API
 */

import { ExtensionConfig, DEFAULT_CONFIG } from '@/types/config'

const CONFIG_KEY = 'config'

// Use local storage to avoid sync quota limits (8KB) which breaks with large defaults
const STORAGE_AREA = chrome.storage.local

export async function getConfig(): Promise<ExtensionConfig> {
    try {
        const result = await STORAGE_AREA.get(CONFIG_KEY)
        return result[CONFIG_KEY] || DEFAULT_CONFIG
    } catch (e) {
        console.error('Failed to get config:', e)
        return DEFAULT_CONFIG
    }
}

export async function saveConfig(config: ExtensionConfig): Promise<void> {
    return new Promise((resolve, reject) => {
        STORAGE_AREA.set({ [CONFIG_KEY]: config }, () => {
            if (chrome.runtime.lastError) {
                console.error('Storage set error:', chrome.runtime.lastError)
                reject(chrome.runtime.lastError)
            } else {
                resolve()
            }
        })
    })
}

export async function updateConfig(
    updates: Partial<ExtensionConfig>
): Promise<ExtensionConfig> {
    const current = await getConfig()
    const updated = { ...current, ...updates }
    await saveConfig(updated)
    return updated
}

// Cache for translated content (local storage, not synced)
const CACHE_KEY = 'translationCache'

interface TranslationCache {
    [key: string]: {
        translation: string
        timestamp: number
    }
}

export async function getCachedTranslation(
    key: string
): Promise<string | null> {
    const result = await chrome.storage.local.get(CACHE_KEY)
    const cache: TranslationCache = result[CACHE_KEY] || {}
    const entry = cache[key]

    if (!entry) return null

    // Cache expires after 24 hours
    const CACHE_TTL = 24 * 60 * 60 * 1000
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        return null
    }

    return entry.translation
}

export async function setCachedTranslation(
    key: string,
    translation: string
): Promise<void> {
    const result = await chrome.storage.local.get(CACHE_KEY)
    const cache: TranslationCache = result[CACHE_KEY] || {}

    cache[key] = {
        translation,
        timestamp: Date.now(),
    }

    await chrome.storage.local.set({ [CACHE_KEY]: cache })
}

export function generateCacheKey(
    text: string,
    sourceLang: string,
    targetLang: string
): string {
    // Simple hash for cache key
    const input = `${sourceLang}:${targetLang}:${text}`
    let hash = 0
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(16)
}
