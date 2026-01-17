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
        const texts = sortedBlocks.map(b =>
            config.displayStyle === 'sense' ? `[SENSE_MODE]${b.text}` : b.text
        )
        const requestId = `stream_${Date.now()}`
        let completedCount = 0

        // Set up listener for streaming chunks
        const streamListener = (message: MessagePayload) => {
            if (message.action === 'STREAM_CHUNK' && message.data) {
                const { requestId: msgReqId, index, translation } = message.data as {
                    requestId: string
                    index: number
                    translation: string
                }
                if (msgReqId === requestId && uiElements[index]) {
                    updateTranslationContent(uiElements[index].ui.content, translation)
                    completedCount++
                    floatingBall?.setProgress(completedCount / sortedBlocks.length)
                }
            } else if (message.action === 'STREAM_COMPLETE' && message.data) {
                const { requestId: msgReqId } = message.data as { requestId: string }
                if (msgReqId === requestId) {
                    console.log('[Immersive Translate] Streaming complete!')
                    chrome.runtime.onMessage.removeListener(streamListener)
                }
            }
        }
        chrome.runtime.onMessage.addListener(streamListener)

        // Send streaming translation request
        const response = await sendMessage({
            action: 'TRANSLATE_STREAM',
            data: {
                texts,
                sourceLang: 'auto',
                targetLang: config.targetLang,
                requestId,
            },
        })

        if (!response.success) {
            console.error('[Immersive Translate] Stream request failed:', response.error)
            // Fall back to error display
            uiElements.forEach(({ ui }) => {
                if (!ui.content.textContent || ui.content.classList.contains('loading')) {
                    updateTranslationContent(ui.content, response.error || '翻译失败', true)
                }
            })
            chrome.runtime.onMessage.removeListener(streamListener)
        }

        console.log('[Immersive Translate] Translation request sent')

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

