
import {
    IAudioEngine,
    AudioInstance,
    SpeakOptions,
    VoiceInfo
} from './types'
import { TtsSession } from '@mintplex-labs/piper-tts-web'

/**
 * Generate unique ID for audio instances
 */
function generateId(): string {
    return `piper_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Piper TTS Audio Engine
 * Uses @mintplex-labs/piper-tts-web for WASM-based in-browser inference
 */
export class PiperAudioEngine implements IAudioEngine {
    // private session: TtsSession | null = null // Unused, using promise instead
    private currentInstance: PiperAudioInstance | null = null
    private sessionPromise: Promise<TtsSession> | null = null
    private currentVoiceId: string | null = null

    // Default config
    private defaultOptions: Partial<SpeakOptions> = {
        lang: 'en_US',
        rate: 1.0,
        volume: 1.0,
        pitch: 1.0
    }

    constructor() {
        // Lazy init in speak() to know which voice to load
    }

    /**
     * Initialize Piper Session with local WASM paths
     */
    private initSession(voiceId: string) {
        try {
            // Configure WASM paths to point to extension assets
            // These files must be in public/piper/ in the source
            // and copied to dist/piper/ in the build
            const wasmBase = chrome.runtime.getURL('piper/')
            this.currentVoiceId = voiceId // Track current voice

            this.sessionPromise = TtsSession.create({
                voiceId: voiceId,
                wasmPaths: {
                    onnxWasm: wasmBase + 'ort-wasm-simd-threaded.wasm',
                    piperData: wasmBase + 'piper_phonemize.data',
                    piperWasm: wasmBase + 'piper_phonemize.wasm'
                },
                logger: (msg) => console.log('[PiperEngine]', msg)
            })

            this.sessionPromise.then(() => {
                // this.session = session
                console.log('[PiperEngine] Session initialized')
            }).catch(err => {
                console.error('[PiperEngine] Failed to init session:', err)
            })
        } catch (e) {
            console.error('[PiperEngine] Init error:', e)
        }
    }

    isSupported(): boolean {
        return true // WASM is supported in modern browsers
    }

    getVoices(): VoiceInfo[] {
        // TODO: Implement voice listing using TtsSession.voices()
        // For now return a hardcoded list or empty
        return []
    }

    speak(text: string, options?: Partial<SpeakOptions>): AudioInstance | null {
        const opts = { ...this.defaultOptions, ...options }

        // Determine voice ID based on language if not provided
        let voiceId = opts.voice
        if (!voiceId) {
            if (opts.lang?.startsWith('zh')) {
                voiceId = 'zh_CN-huayan-medium'
            } else {
                voiceId = 'en_US-hfc_female-medium'
            }
        }

        // Initialize or switch session if needed
        if (!this.sessionPromise || this.currentVoiceId !== voiceId) {
            console.log(`[PiperEngine] Switching voice: ${this.currentVoiceId} -> ${voiceId}`)
            this.initSession(voiceId)
        }

        const id = generateId()
        const instance = new PiperAudioInstance(id, text, opts, this.sessionPromise!)

        this.currentInstance = instance

        // Auto play
        instance.play()

        return instance
    }

    pause(): void {
        this.currentInstance?.pause()
    }

    resume(): void {
        this.currentInstance?.play()
    }

    stop(): void {
        this.currentInstance?.stop()
        this.currentInstance = null
    }

    setRate(rate: number): void {
        this.defaultOptions.rate = rate
    }

    setVolume(volume: number): void {
        this.defaultOptions.volume = volume
    }
}

/**
 * Audio instance for Piper TTS
 * Wraps HTMLAudioElement + Async Generation
 */
class PiperAudioInstance implements AudioInstance {
    id: string
    text: string
    startTime: number = 0
    endTime: number = 0
    isPlaying: boolean = false

    private audio: HTMLAudioElement
    private endCallbacks: Array<() => void> = []
    private sessionPromise: Promise<TtsSession>
    private options: Partial<SpeakOptions>
    private blobUrl: string | null = null
    private isGenerating: boolean = false
    private playRequested: boolean = false

    constructor(
        id: string,
        text: string,
        options: Partial<SpeakOptions>,
        sessionPromise: Promise<TtsSession>
    ) {
        this.id = id
        this.text = text
        this.options = options
        this.sessionPromise = sessionPromise

        this.audio = new Audio()
        this.audio.onended = () => {
            this.isPlaying = false
            this._triggerEnd()
        }
        this.audio.onerror = (e) => {
            console.error('[PiperInstance] Audio error:', e)
            this.isPlaying = false
        }

        this.generate()
    }

    private async generate() {
        this.isGenerating = true
        try {
            const session = await this.sessionPromise
            // TODO: Handle voice switching if options.voice differs from session voice
            // const voiceId = this.options.voice || 'en_US-hfc_female-medium'

            // Check if we need to switch voice on session? 
            // TtsSession seems bound to a voiceId in constructor.
            // But library might support switching? 
            // Looking at TtsSession definition, voiceId is a property.
            // We might need a new session for a new voice or check if predict accepts voiceId.
            // The standalone predict(config) accepts voiceId.
            // But we are using session directly.
            // Let's assume for now we use the session's voice or re-create session if needed.
            // Actually, TtsSession methods might not expose voice switching easily. 
            // But let's try just calling predict on session.

            const blob = await session.predict(this.text)
            this.blobUrl = URL.createObjectURL(blob)

            this.audio.src = this.blobUrl
            this.audio.playbackRate = this.options.rate || 1.0
            this.audio.volume = this.options.volume || 1.0

            this.isGenerating = false

            if (this.playRequested) {
                this.doPlay()
            }
        } catch (e) {
            console.error('[PiperInstance] Generation failed:', e)
            this.isGenerating = false
        }
    }

    play(): void {
        this.playRequested = true
        if (!this.isGenerating && this.blobUrl) {
            this.doPlay()
        }
    }

    private doPlay() {
        this.audio.play().catch(e => console.error('[PiperInstance] Play error:', e))
        this.isPlaying = true
    }

    pause(): void {
        this.playRequested = false
        this.audio.pause()
        this.isPlaying = false
    }

    stop(): void {
        this.playRequested = false
        this.audio.pause()
        this.audio.currentTime = 0
        this.isPlaying = false
        if (this.blobUrl) {
            URL.revokeObjectURL(this.blobUrl)
            this.blobUrl = null
        }
    }

    seek(time: number): void {
        if (Number.isFinite(time)) {
            this.audio.currentTime = time
        }
    }

    onEnd(callback: () => void): void {
        this.endCallbacks.push(callback)
    }

    _triggerEnd(): void {
        this.endCallbacks.forEach(cb => cb())
    }
}
