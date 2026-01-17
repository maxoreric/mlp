/**
 * VTT/SRT Subtitle Parser
 * Parses common subtitle formats
 */

import { SubtitleItem, ParsedSubtitles } from './types'

/**
 * Parse VTT (WebVTT) format
 */
export function parseVTT(content: string): SubtitleItem[] {
    const subtitles: SubtitleItem[] = []
    const lines = content.split(/\r?\n/)

    let currentCue: Partial<SubtitleItem> | null = null

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()

        // Skip WEBVTT header and empty lines
        if (line === 'WEBVTT' || line.startsWith('NOTE') || line === '') {
            if (currentCue?.text) {
                subtitles.push(currentCue as SubtitleItem)
                currentCue = null
            }
            continue
        }

        // Check for timestamp line
        const timestampMatch = line.match(
            /^(\d{2}:)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})[.,](\d{3})/
        )

        if (timestampMatch) {
            if (currentCue?.text) {
                subtitles.push(currentCue as SubtitleItem)
            }

            const startH = timestampMatch[1] ? parseInt(timestampMatch[1]) : 0
            const startM = parseInt(timestampMatch[2])
            const startS = parseInt(timestampMatch[3])
            const startMs = parseInt(timestampMatch[4])

            const endH = timestampMatch[5] ? parseInt(timestampMatch[5]) : 0
            const endM = parseInt(timestampMatch[6])
            const endS = parseInt(timestampMatch[7])
            const endMs = parseInt(timestampMatch[8])

            currentCue = {
                start: startH * 3600 + startM * 60 + startS + startMs / 1000,
                end: endH * 3600 + endM * 60 + endS + endMs / 1000,
                text: ''
            }
        } else if (currentCue) {
            // Text line
            if (currentCue.text) {
                currentCue.text += '\n'
            }
            currentCue.text = (currentCue.text || '') + line
        }
    }

    // Push last cue
    if (currentCue?.text) {
        subtitles.push(currentCue as SubtitleItem)
    }

    return subtitles
}

/**
 * Parse SRT format
 */
export function parseSRT(content: string): SubtitleItem[] {
    const subtitles: SubtitleItem[] = []
    const blocks = content.trim().split(/\n\n+/)

    for (const block of blocks) {
        const lines = block.split(/\r?\n/)
        if (lines.length < 2) continue

        // Find timestamp line (skip index line)
        let timestampLine = lines[0]
        let textStartIndex = 1

        // If first line is numeric index, skip it
        if (/^\d+$/.test(lines[0].trim())) {
            timestampLine = lines[1]
            textStartIndex = 2
        }

        const timestampMatch = timestampLine.match(
            /^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
        )

        if (timestampMatch) {
            const start =
                parseInt(timestampMatch[1]) * 3600 +
                parseInt(timestampMatch[2]) * 60 +
                parseInt(timestampMatch[3]) +
                parseInt(timestampMatch[4]) / 1000

            const end =
                parseInt(timestampMatch[5]) * 3600 +
                parseInt(timestampMatch[6]) * 60 +
                parseInt(timestampMatch[7]) +
                parseInt(timestampMatch[8]) / 1000

            const text = lines.slice(textStartIndex).join('\n').trim()

            if (text) {
                subtitles.push({ start, end, text })
            }
        }
    }

    return subtitles
}

/**
 * Parse YouTube JSON format
 */
export function parseYouTubeJSON(data: any): SubtitleItem[] {
    if (!data?.events) return []

    const subtitles: SubtitleItem[] = []

    for (const event of data.events) {
        if (!event.segs) continue

        const text = event.segs
            .map((seg: any) => seg.utf8 || '')
            .join('')
            .trim()

        if (text) {
            subtitles.push({
                start: event.tStartMs / 1000,
                end: (event.tStartMs + (event.dDurationMs || 2000)) / 1000,
                text
            })
        }
    }

    return subtitles
}

/**
 * Parse Bilibili JSON format
 */
export function parseBilibiliJSON(data: any): SubtitleItem[] {
    const body = data?.body || data
    if (!Array.isArray(body)) return []

    return body.map((item: any) => ({
        start: item.from,
        end: item.to,
        text: item.content || ''
    })).filter((item: SubtitleItem) => item.text)
}

/**
 * Auto-detect format and parse
 */
export function parseSubtitles(content: string | any): ParsedSubtitles {
    // If already object, check known structures
    if (typeof content === 'object') {
        // YouTube JSON
        if (content?.events) {
            return {
                subtitles: parseYouTubeJSON(content),
                format: 'json',
                language: content?.wireMagic ? 'en' : undefined  // YouTube has wireMagic field
            }
        }

        // Bilibili JSON
        if (content?.body && Array.isArray(content.body)) {
            return {
                subtitles: parseBilibiliJSON(content),
                format: 'json'
            }
        }

        // Array of cues directly
        if (Array.isArray(content)) {
            return {
                subtitles: parseBilibiliJSON({ body: content }),
                format: 'json'
            }
        }

        return { subtitles: [], format: 'unknown' }
    }

    // String content
    const text = content.toString().trim()

    // VTT
    if (text.startsWith('WEBVTT')) {
        return {
            subtitles: parseVTT(text),
            format: 'vtt'
        }
    }

    // SRT (starts with number)
    if (/^\d+\s*\r?\n\d{2}:\d{2}:\d{2}/.test(text)) {
        return {
            subtitles: parseSRT(text),
            format: 'srt'
        }
    }

    // Try JSON
    try {
        const json = JSON.parse(text)
        return parseSubtitles(json)
    } catch {
        // Not JSON
    }

    return { subtitles: [], format: 'unknown' }
}

/**
 * Convert subtitles to VTT format
 */
export function toVTT(subtitles: SubtitleItem[], includeTranslation = true): string {
    const lines = ['WEBVTT', '']

    for (const sub of subtitles) {
        const startTime = formatVTTTime(sub.start)
        const endTime = formatVTTTime(sub.end)

        let text = sub.text
        if (includeTranslation && sub.translation) {
            text = `${sub.text}\n${sub.translation}`
        }

        lines.push(`${startTime} --> ${endTime}`)
        lines.push(text)
        lines.push('')
    }

    return lines.join('\n')
}

/**
 * Format time for VTT
 */
function formatVTTTime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.round((seconds % 1) * 1000)

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

/**
 * Merge source and translated subtitles
 */
export function mergeSubtitles(
    source: SubtitleItem[],
    translations: Map<number, string>,
    delimiter = '\n'
): SubtitleItem[] {
    return source.map((item, index) => {
        const translation = translations.get(index)
        return {
            ...item,
            translation,
            text: translation
                ? `${item.text}${delimiter}${translation}`
                : item.text
        }
    })
}
