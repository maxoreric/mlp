/**
 * Offscreen Document for Piper TTS
 * Runs in isolated extension context with full WASM support
 */

import { TtsSession } from '@mintplex-labs/piper-tts-web'
import * as ort from 'onnxruntime-web'

console.log('[OffscreenTTS] Initializing...')

// Configure ONNX Runtime WASM paths globally for Chrome extension context
const wasmBasePath = chrome.runtime.getURL('piper/')
ort.env.wasm.wasmPaths = wasmBasePath
// Disable multi-threading which can cause issues in extension context
ort.env.wasm.numThreads = 1

console.log('[OffscreenTTS] ORT configured with path:', wasmBasePath)

// TTS Session management
let currentSession: TtsSession | null = null
let currentVoiceId: string | null = null
let currentAudio: HTMLAudioElement | null = null

// Message types
interface TTSSpeakMessage {
    action: 'TTS_SPEAK'
    data: {
        text: string
        voiceId?: string
        lang?: string
        requestId: string
    }
}

interface TTSStopMessage {
    action: 'TTS_STOP'
}

type TTSMessage = TTSSpeakMessage | TTSStopMessage

/**
 * Initialize or get existing TTS session
 */
async function getSession(voiceId: string): Promise<TtsSession> {
    if (currentSession && currentVoiceId === voiceId) {
        return currentSession
    }

    console.log(`[OffscreenTTS] Creating session for voice: ${voiceId}`)

    // Configure WASM paths to point to extension assets
    // files are in public/piper/ -> dist/piper/
    const wasmBase = chrome.runtime.getURL('piper/')

    currentSession = await TtsSession.create({
        voiceId: voiceId,
        wasmPaths: {
            onnxWasm: wasmBase + 'ort-wasm-simd-threaded.wasm',
            piperData: wasmBase + 'piper_phonemize.data',
            piperWasm: wasmBase + 'piper_phonemize.wasm'
        },
        logger: (msg) => console.log('[OffscreenTTS]', msg)
    })
    currentVoiceId = voiceId

    console.log('[OffscreenTTS] Session initialized')
    return currentSession
}

/**
 * Speak text using Piper TTS
 */
async function speak(text: string, voiceId: string, requestId: string): Promise<void> {
    console.log(`[OffscreenTTS] Speaking: "${text.substring(0, 50)}..."`)

    try {
        const session = await getSession(voiceId)
        const audioBlob = await session.predict(text)

        // Stop any currently playing audio
        if (currentAudio) {
            currentAudio.pause()
            if (currentAudio.src) {
                URL.revokeObjectURL(currentAudio.src)
            }
        }

        // Create and play new audio
        const audioUrl = URL.createObjectURL(audioBlob)
        currentAudio = new Audio(audioUrl)

        currentAudio.onended = () => {
            console.log('[OffscreenTTS] Audio ended')
            // Notify background that TTS finished
            chrome.runtime.sendMessage({
                action: 'TTS_END',
                data: { requestId }
            })
            // Cleanup
            if (currentAudio?.src) {
                URL.revokeObjectURL(currentAudio.src)
            }
        }

        currentAudio.onerror = (e) => {
            console.error('[OffscreenTTS] Audio error:', e)
            chrome.runtime.sendMessage({
                action: 'TTS_ERROR',
                data: { requestId, error: 'Audio playback error' }
            })
        }

        await currentAudio.play()
        console.log('[OffscreenTTS] Playing audio')

    } catch (error) {
        console.error('[OffscreenTTS] TTS error:', error)
        chrome.runtime.sendMessage({
            action: 'TTS_ERROR',
            data: {
                requestId,
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        })
    }
}

/**
 * Stop current TTS playback
 */
function stop(): void {
    if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
        if (currentAudio.src) {
            URL.revokeObjectURL(currentAudio.src)
        }
        currentAudio = null
    }
    console.log('[OffscreenTTS] Stopped')
}

/**
 * Message listener
 */
chrome.runtime.onMessage.addListener((message: TTSMessage, _sender, sendResponse) => {
    console.log('[OffscreenTTS] Received message:', message.action)

    if (message.action === 'TTS_SPEAK') {
        const { text, voiceId, lang, requestId } = message.data

        // Determine voice ID based on language if not provided
        let voice = voiceId
        if (!voice) {
            if (lang?.startsWith('zh')) {
                voice = 'zh_CN-huayan-medium'
            } else {
                voice = 'en_US-hfc_female-medium'
            }
        }

        speak(text, voice, requestId)
            .then(() => sendResponse({ success: true }))
            .catch((err) => sendResponse({ success: false, error: err.message }))

        return true // Keep channel open for async response
    }

    if (message.action === 'TTS_STOP') {
        stop()
        sendResponse({ success: true })
        return false
    }

    return false
})

console.log('[OffscreenTTS] Ready')
