
import {
    IAudioEngine,
    AudioInstance,
    SpeakOptions,
    VoiceInfo
} from './types'
import { MessagePayload } from '@/types/messages'

/**
 * Generate unique ID for audio instances
 */
function generateId(): string {
    return `piper_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Piper Client Audio Engine
 * 
 * Functions as a proxy to the background/offscreen TTS service.
 * Does NOT load WASM or heavy dependencies in the content script.
 */
export class PiperAudioEngine implements IAudioEngine {
    private currentInstance: PiperClientAudioInstance | null = null
    private boundMessageHandler: (message: MessagePayload) => void

    // Default config
    private defaultOptions: Partial<SpeakOptions> = {
        lang: 'en_US',
        rate: 1.0,
        volume: 1.0,
        pitch: 1.0
    }

    constructor() {
        // Listen for callbacks from background -> content script
        this.boundMessageHandler = this.handleMessage.bind(this)
        chrome.runtime.onMessage.addListener(this.boundMessageHandler)
    }

    isSupported(): boolean {
        return true
    }

    getVoices(): VoiceInfo[] {
        // TODO: Could fetch from backend
        return [
            { name: 'Piper English (Female)', lang: 'en-US', id: 'en_US-hfc_female-medium', localService: true, default: false },
            { name: 'Piper Chinese (Huayan)', lang: 'zh-CN', id: 'zh_CN-huayan-medium', localService: true, default: true }
        ]
    }

    speak(text: string, options?: Partial<SpeakOptions>): AudioInstance | null {
        const opts = { ...this.defaultOptions, ...options }
        const requestId = generateId()

        // Determine voice ID based on language if not provided
        let voiceId = opts.voice
        if (!voiceId) {
            if (opts.lang?.startsWith('zh')) {
                voiceId = 'zh_CN-huayan-medium'
            } else {
                voiceId = 'en_US-hfc_female-medium'
            }
        }

        const instance = new PiperClientAudioInstance(requestId, text, opts)
        this.currentInstance = instance

        // Send request to background
        chrome.runtime.sendMessage({
            action: 'TTS_SPEAK',
            data: {
                text,
                voiceId,
                lang: opts.lang,
                rate: opts.rate,
                volume: opts.volume,
                requestId
            }
        }).catch(err => {
            console.error('[PiperClient] Failed to send TTS request:', err)
            instance._triggerError(err)
        })

        return instance
    }

    pause(): void {
        // Not fully supported in current offscreen implementation, but we can send a stop
        // or add PAUSE action to offscreen later
        console.warn('[PiperClient] Pause not fully implemented for offscreen TTS')
    }

    resume(): void {
        console.warn('[PiperClient] Resume not fully implemented for offscreen TTS')
    }

    stop(): void {
        if (this.currentInstance) {
            chrome.runtime.sendMessage({ action: 'TTS_STOP' }).catch(() => { })
            this.currentInstance = null
        }
    }

    setRate(rate: number): void {
        this.defaultOptions.rate = rate
    }

    setVolume(volume: number): void {
        this.defaultOptions.volume = volume
    }

    private handleMessage(message: MessagePayload) {
        if (!this.currentInstance) return

        if (message.action === 'TTS_END') {
            const data = message.data as { requestId: string }
            if (data.requestId === this.currentInstance.id) {
                this.currentInstance._triggerEnd()
            }
        } else if (message.action === 'TTS_ERROR') {
            const data = message.data as { requestId: string, error?: string }
            if (data.requestId === this.currentInstance.id) {
                console.error('[PiperClient] TTS Error:', data.error)
                this.currentInstance._triggerError(data.error)
            }
        }
    }

    destroy() {
        chrome.runtime.onMessage.removeListener(this.boundMessageHandler)
    }
}

/**
 * Client-side Audio Instance representation
 */
class PiperClientAudioInstance implements AudioInstance {
    id: string
    text: string
    startTime: number = 0
    endTime: number = 0

    // We don't strictly track isPlaying here since it's remote, 
    // but we assume true after creation until end
    isPlaying: boolean = true

    private endCallbacks: Array<() => void> = []
    private errorCallbacks: Array<(err: any) => void> = []

    constructor(
        id: string,
        text: string,
        _options: Partial<SpeakOptions>
    ) {
        this.id = id
        this.text = text
    }

    play(): void {
        // Already played via sendMessage in engine
    }

    pause(): void {
        // Remote control needed
    }

    stop(): void {
        // Handled by engine stop() typically, but instance level also exists
        chrome.runtime.sendMessage({ action: 'TTS_STOP' }).catch(() => { })
    }

    seek(_time: number): void {
        // Not supported
    }

    onEnd(callback: () => void): void {
        this.endCallbacks.push(callback)
    }

    onError(callback: (err: any) => void): void {
        this.errorCallbacks.push(callback)
    }

    _triggerEnd(): void {
        this.isPlaying = false
        this.endCallbacks.forEach(cb => cb())
    }

    _triggerError(err: any): void {
        this.isPlaying = false
        this.errorCallbacks.forEach(cb => cb(err))
    }
}
