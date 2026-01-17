/**
 * Message types for communication between extension components
 */

export type MessageAction =
    | 'TRANSLATE_BATCH'
    | 'TRANSLATE_STREAM'   // Start streaming translation
    | 'STREAM_CHUNK'       // Partial streaming result
    | 'STREAM_COMPLETE'    // Streaming finished
    | 'GET_CONFIG'
    | 'SAVE_CONFIG'
    | 'TRANSLATE_CHUNK'  // For streaming responses
    | 'TRANSLATE_PAGE'   // Trigger page translation
    | 'TOGGLE_TRANSLATION'  // Show/hide translations
    | 'RESTORE_PAGE'     // Remove all translations
    | 'TOGGLE_DUBBING'   // Enable/disable voice dubbing
    // TTS via Offscreen Document
    | 'TTS_SPEAK'        // Request TTS playback
    | 'TTS_STOP'         // Stop TTS playback
    | 'TTS_END'          // TTS playback finished (from offscreen)
    | 'TTS_ERROR'        // TTS error (from offscreen)

export interface MessagePayload {
    action: MessageAction
    data?: unknown
    requestId?: string
}

export interface MessageResponse {
    success: boolean
    data?: unknown
    error?: string
}

export interface TranslateRequest {
    texts: string[]
    sourceLang: string
    targetLang: string
}

export interface TranslateChunk {
    requestId: string
    index: number
    text: string
    done: boolean
}
