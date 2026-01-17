/**
 * Background Service Worker
 * Handles message passing, API requests (to avoid CORS), and extension lifecycle
 */

import { MessagePayload, MessageResponse } from '@/types/messages'
import { translateWithAdapter, translateStreamWithAdapter } from '@/services/translator'
import { getConfig, saveConfig } from '@/lib/storage'

// Offscreen document state
let offscreenDocumentCreating: Promise<void> | null = null

/**
 * Ensure offscreen document is created for TTS
 */
async function ensureOffscreenDocument(): Promise<void> {
    // Check if already exists
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType]
    })

    if (existingContexts.length > 0) {
        return
    }

    // Avoid race conditions
    if (offscreenDocumentCreating) {
        await offscreenDocumentCreating
        return
    }

    offscreenDocumentCreating = chrome.offscreen.createDocument({
        url: 'src/offscreen/offscreen.html',
        reasons: ['AUDIO_PLAYBACK' as chrome.offscreen.Reason],
        justification: 'Piper TTS audio synthesis and playback'
    })

    await offscreenDocumentCreating
    offscreenDocumentCreating = null
    console.log('[Background] Offscreen document created')
}

// Message handler
chrome.runtime.onMessage.addListener(
    (message: MessagePayload, sender, sendResponse): boolean => {
        handleMessage(message, sender).then(sendResponse)
        return true // Keep channel open for async response
    }
)

async function handleMessage(
    message: MessagePayload,
    sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
    try {
        switch (message.action) {
            case 'TRANSLATE_BATCH':
                return await handleTranslateBatch(message.data as { texts: string[]; sourceLang: string; targetLang: string })

            case 'TRANSLATE_STREAM':
                return await handleTranslateStream(
                    message.data as { texts: string[]; sourceLang: string; targetLang: string; requestId: string },
                    sender
                )

            case 'GET_CONFIG':
                return await handleGetConfig()

            case 'SAVE_CONFIG':
                return await handleSaveConfig(message.data)

            case 'TTS_SPEAK':
                return await handleTTSSpeak(message.data as { text: string; voiceId?: string; lang?: string; requestId: string }, sender)

            case 'TTS_STOP':
                return await handleTTSStop()

            case 'TTS_END':
            case 'TTS_ERROR':
                // Forward to content script
                return await handleTTSCallback(message, sender)

            default:
                return { success: false, error: 'Unknown action' }
        }
    } catch (error) {
        console.error('Background error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

async function handleTranslateBatch(data: {
    texts: string[]
    sourceLang: string
    targetLang: string
}): Promise<MessageResponse> {
    const config = await getConfig()
    const results = await translateWithAdapter(
        data.texts,
        data.sourceLang,
        data.targetLang,
        config
    )
    return { success: true, data: results }
}

/**
 * Streaming translation - sends partial results back to content script via messages
 */
async function handleTranslateStream(
    data: { texts: string[]; sourceLang: string; targetLang: string; requestId: string },
    sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
    const config = await getConfig()
    const tabId = sender.tab?.id

    if (!tabId) {
        return { success: false, error: 'No tab ID' }
    }

    try {
        await translateStreamWithAdapter(
            data.texts,
            data.sourceLang,
            data.targetLang,
            config,
            (index: number, translation: string) => {
                // Send partial result to content script
                chrome.tabs.sendMessage(tabId, {
                    action: 'STREAM_CHUNK',
                    data: { requestId: data.requestId, index, translation }
                }).catch(() => { }) // Ignore if tab closed
            }
        )

        // Send completion signal
        chrome.tabs.sendMessage(tabId, {
            action: 'STREAM_COMPLETE',
            data: { requestId: data.requestId }
        }).catch(() => { })

        return { success: true }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Stream failed'
        }
    }
}

async function handleGetConfig(): Promise<MessageResponse> {
    const config = await getConfig()
    return { success: true, data: config }
}

async function handleSaveConfig(data: any): Promise<MessageResponse> {
    console.log('[Background] Saving config:', data)
    try {
        await saveConfig(data)
        // Verify save
        const saved = await getConfig()
        console.log('[Background] Config saved. New state:', saved)
        return { success: true }
    } catch (e) {
        console.error('[Background] Save config failed:', e)
        return { success: false, error: String(e) }
    }
}

/**
 * Handle TTS speak request - forward to offscreen document
 */
async function handleTTSSpeak(
    data: { text: string; voiceId?: string; lang?: string; requestId: string },
    sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
    console.log('[Background] TTS speak request:', data.text.substring(0, 50))

    try {
        await ensureOffscreenDocument()

        // Forward to offscreen document
        // Store sender tab for callback
        const tabId = sender.tab?.id
        if (tabId) {
            pendingTTSRequests.set(data.requestId, tabId)
        }

        // Send to offscreen (it listens via chrome.runtime.onMessage)
        await chrome.runtime.sendMessage({
            action: 'TTS_SPEAK',
            data
        })

        return { success: true }
    } catch (error) {
        console.error('[Background] TTS speak error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'TTS failed'
        }
    }
}

/**
 * Handle TTS stop request
 */
async function handleTTSStop(): Promise<MessageResponse> {
    console.log('[Background] TTS stop request')

    try {
        // Forward stop to offscreen
        await chrome.runtime.sendMessage({
            action: 'TTS_STOP'
        })
        return { success: true }
    } catch (error) {
        return { success: false, error: 'TTS stop failed' }
    }
}

// Track pending TTS requests to route callbacks
const pendingTTSRequests = new Map<string, number>()

/**
 * Handle TTS callbacks from offscreen (TTS_END, TTS_ERROR)
 */
async function handleTTSCallback(
    message: MessagePayload,
    _sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
    const requestId = (message.data as any)?.requestId
    const tabId = pendingTTSRequests.get(requestId)

    if (tabId) {
        // Forward to content script
        chrome.tabs.sendMessage(tabId, message).catch(() => { })
        pendingTTSRequests.delete(requestId)
    }

    return { success: true }
}

// Extension install/update handler
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Immersive Translate OSS installed!')
        // Initialize default config
        chrome.storage.local.set({
            config: {
                enabled: true,
                sourceLang: 'auto',
                targetLang: 'zh-CN',
                translationService: {
                    type: 'google',
                },
                displayStyle: 'block',
                // Ensure videoSubtitle default is set on fresh install
                videoSubtitle: {
                    enabled: true,
                    fontSize: 20,
                    opacity: 0.8,
                    color: '#FFFFFF',
                    backgroundColor: '#000000',
                },
                siteRules: [],
            },
        })
    }
})

console.log('Background service worker started')
