/**
 * Content Script Entry Point
 * Handles page translation with smart DOM parsing
 */

import { parseDocument, detectLanguage } from '@/core/dom-parser'
import { injectTranslationUI, updateTranslationContent, removeAllTranslations, toggleTranslations } from '@/core/shadow-dom'
import { FloatingBall } from '@/core/floating-ball'
import { initVideoHook, VideoHook } from './video'
import { MessagePayload, MessageResponse } from '@/types/messages'
import { ExtensionConfig, DEFAULT_CONFIG } from '@/types/config'

let config: ExtensionConfig = DEFAULT_CONFIG
let floatingBall: FloatingBall | null = null
// @ts-ignore
let videoHook: VideoHook = null
let isTranslating = false
let translatedBlocks = new WeakSet<HTMLElement>()

// Initialize on load
init()

async function init(): Promise<void> {
    console.log('[Immersive Translate] Content script initializing... URL:', window.location.href, 'ContentType:', document.contentType)

    // Check for PDF
    if (document.contentType === 'application/pdf' || window.location.href.toLowerCase().endsWith('.pdf')) {
        console.log('[Immersive Translate] PDF detected, redirecting to viewer...')
        const pdfViewerUrl = chrome.runtime.getURL('pdf/index.html')
        const currentUrl = window.location.href
        // Avoid redirect loop
        if (!currentUrl.includes(pdfViewerUrl)) {
            window.location.replace(`${pdfViewerUrl}?file=${encodeURIComponent(currentUrl)}`)
            return
        }
    }

    // Load config
    try {
        const response = await sendMessage({ action: 'GET_CONFIG' })
        if (response.success && response.data) {
            config = response.data as ExtensionConfig
        }
    } catch (error) {
        console.warn('[Immersive Translate] Failed to load config:', error)
    }

    // Create floating ball
    floatingBall = new FloatingBall({
        initialPosition: config.floatingBall?.position,
        onTranslate: () => translatePage(),
        onSettings: () => chrome.runtime.openOptionsPage(),
        onToggle: (enabled) => {
            if (enabled) {
                toggleTranslations(true)
            } else {
                removeAllTranslations()
                translatedBlocks = new WeakSet()
            }
        },
        onPositionChange: (x, y) => {
            // Update local config object
            if (!config.floatingBall) {
                config.floatingBall = { position: { x, y } }
            } else {
                config.floatingBall.position = { x, y }
            }

            // Save to storage
            chrome.storage.local.get('config', (result) => {
                const currentConfig = result.config || {}
                const newConfig = {
                    ...currentConfig,
                    floatingBall: {
                        ...(currentConfig.floatingBall || {}),
                        position: { x, y }
                    }
                }
                chrome.storage.local.set({ config: newConfig })
            })
        }
    })

    if (config.enabled) {
        floatingBall.mount()
    }

    // Initialize video hook (YouTube/Bilibili)
    videoHook = initVideoHook()

    // Expose videoHook globally for console testing
    if (videoHook) {
        (window as any).__imtVideoHook = videoHook
        console.log('[Immersive Translate] Video hook exposed as window.__imtVideoHook')
        console.log('[Immersive Translate] To enable dubbing, run: window.__imtVideoHook.enableDubbing()')
    }

    console.log('[Immersive Translate] Video hook initialized:', videoHook)

    // Setup message listener
    setupMessageListener()

    // Setup IntersectionObserver for lazy translation
    setupLazyTranslation()

    console.log('[Immersive Translate] Content script ready')
}

/**
 * Listen for messages from popup/background
 */
function setupMessageListener(): void {
    chrome.runtime.onMessage.addListener(
        (message: MessagePayload, _sender, sendResponse) => {
            switch (message.action) {
                case 'TRANSLATE_PAGE':
                    translatePage().then(() => sendResponse({ success: true }))
                    return true

                case 'TOGGLE_TRANSLATION':
                    const show = message.data as boolean
                    toggleTranslations(show)
                    sendResponse({ success: true })
                    break

                case 'RESTORE_PAGE':
                    removeAllTranslations()
                    translatedBlocks = new WeakSet()
                    sendResponse({ success: true })
                    break

                case 'TOGGLE_DUBBING':
                    if (videoHook && 'enableDubbing' in videoHook) {
                        const ytHook = videoHook as any
                        if (ytHook.isDubbingEnabled?.()) {
                            ytHook.disableDubbing()
                        } else {
                            ytHook.enableDubbing()
                        }
                        sendResponse({ success: true })
                    } else {
                        sendResponse({ success: false, error: 'Video hook not available' })
                    }
                    break
            }
        }
    )
}

/**
 * Setup IntersectionObserver for lazy/viewport-based translation
 */
function setupLazyTranslation(): void {
    const observer = new IntersectionObserver(
        (entries) => {
            // Only translate visible blocks when auto-translate is enabled
            if (!config.enabled) return

            const visibleBlocks: HTMLElement[] = []

            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const el = entry.target as HTMLElement
                    if (!translatedBlocks.has(el)) {
                        visibleBlocks.push(el)
                    }
                }
            }

            // Batch translate visible blocks (optional - can be disabled)
            // translateBlocks(visibleBlocks)
        },
        { rootMargin: '200px' }
    )

    // Observe all potential content blocks
    document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote').forEach(el => {
        observer.observe(el)
    })
}

/**
 * Main page translation function
 * Uses streaming translation: sends all texts at once, updates UI as chunks arrive
 */
async function translatePage(): Promise<void> {
    if (isTranslating) {
        console.log('[Immersive Translate] Translation already in progress')
        return
    }

    isTranslating = true
    floatingBall?.setTranslating(true)

    console.log('[Immersive Translate] Starting page translation...')

    try {
        // Parse document for translatable blocks
        const blocks = parseDocument()
        console.log(`[Immersive Translate] Found ${blocks.length} translatable blocks`)

        if (blocks.length === 0) {
            console.log('[Immersive Translate] No content to translate')
            return
        }

        // Filter out already translated blocks
        const newBlocks = blocks.filter(block => !translatedBlocks.has(block.element))

        if (newBlocks.length === 0) {
            console.log('[Immersive Translate] All content already translated')
            return
        }

        // Filter blocks that need translation (detect language)
        const blocksToTranslate = newBlocks.filter(block => {
            const lang = detectLanguage(block.text)
            return lang === 'en' && config.targetLang.startsWith('zh')
        })

        console.log(`[Immersive Translate] ${blocksToTranslate.length} blocks need translation`)

        // Sort blocks by visibility: visible ones first
        const viewportHeight = window.innerHeight
        const sortedBlocks = [...blocksToTranslate].sort((a, b) => {
            const rectA = a.element.getBoundingClientRect()
            const rectB = b.element.getBoundingClientRect()
            const aVisible = rectA.top >= 0 && rectA.top <= viewportHeight
            const bVisible = rectB.top >= 0 && rectB.top <= viewportHeight
            if (aVisible && !bVisible) return -1
            if (!aVisible && bVisible) return 1
            return rectA.top - rectB.top // Sort by vertical position
        })

        // Inject loading UI for all blocks immediately (fast user feedback)
        const uiElements = sortedBlocks.map(block => {
            const ui = injectTranslationUI(block.element, { style: config.displayStyle })
            translatedBlocks.add(block.element)
            return { block, ui }
        })

        // Prepare texts for streaming translation
        const allTexts = sortedBlocks.map(b =>
            config.displayStyle === 'sense' ? `[SENSE_MODE]${b.text}` : b.text
        )

        const batchSize = config.requestBatchSize || 20
        let completedCount = 0

        const requestOffsetMap = new Map<string, number>()

        const globalStreamListener = (message: MessagePayload) => {
            if (message.action === 'STREAM_CHUNK' && message.data) {
                const { requestId: msgReqId, index, translation } = message.data as { requestId: string, index: number, translation: string }

                if (requestOffsetMap.has(msgReqId)) {
                    const offset = requestOffsetMap.get(msgReqId)!
                    const globalIndex = offset + index

                    if (uiElements[globalIndex]) {
                        updateTranslationContent(uiElements[globalIndex].ui.content, translation)
                        // Note: we might want to track completion per block effectively
                    }
                }
            }
        }

        chrome.runtime.onMessage.addListener(globalStreamListener)

        // Process in batches
        for (let i = 0; i < allTexts.length; i += batchSize) {
            if (!isTranslating) break // Allow abort

            const chunkTexts = allTexts.slice(i, i + batchSize)
            const requestId = `stream_batch_${Date.now()}_${i}`
            requestOffsetMap.set(requestId, i) // Store offset for this batch

            console.log(`[Immersive Translate] Processing batch starting at ${i}, size: ${chunkTexts.length}`)

            const response = await sendMessage({
                action: 'TRANSLATE_STREAM',
                data: {
                    texts: chunkTexts,
                    sourceLang: 'auto',
                    targetLang: config.targetLang,
                    requestId,
                },
            })

            if (!response.success) {
                console.error(`[Immersive Translate] Batch failed (start: ${i}):`, response.error)
                // Mark these as failed
                chunkTexts.forEach((_, idx) => {
                    const ui = uiElements[i + idx].ui
                    updateTranslationContent(ui.content, response.error || '翻译失败', true)
                })
            }

            // Clean up map for this request
            requestOffsetMap.delete(requestId)

            // Update progress
            completedCount += chunkTexts.length
            floatingBall?.setProgress(completedCount / sortedBlocks.length)
        }

        chrome.runtime.onMessage.removeListener(globalStreamListener)
        console.log('[Immersive Translate] All batches complete')

    } catch (error) {
        console.error('[Immersive Translate] Translation failed:', error)
    } finally {
        isTranslating = false
        floatingBall?.setTranslating(false)
        floatingBall?.setProgress(0)
    }
}

/**
 * Send message to background script
 */
async function sendMessage(payload: MessagePayload): Promise<MessageResponse> {
    return chrome.runtime.sendMessage(payload)
}

