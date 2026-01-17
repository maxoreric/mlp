/**
 * Smart DOM Parser
 * Identifies main content areas and extracts translatable blocks
 * Based on Readability-like heuristics
 */

export interface TranslatableBlock {
    element: HTMLElement
    text: string
    tokens: TokenizedText
    score: number
}

export interface TokenizedText {
    raw: string
    segments: TextSegment[]
}

export interface TextSegment {
    type: 'text' | 'tag'
    content: string
    tagIndex?: number  // For restoring tags after translation
}

// Tags that should never be translated
const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'KBD', 'SAMP',
    'SVG', 'MATH', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME', 'OBJECT',
    'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON',
])

// Containers that typically don't contain main content
const EXCLUDE_SELECTORS = [
    'nav', 'header', 'footer', 'aside', 'menu',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '[role="complementary"]', '[role="search"]',
    '.nav', '.navigation', '.menu', '.sidebar', '.footer', '.header',
    '.ad', '.ads', '.advertisement', '.sponsor', '.cookie-notice',
    '.share', '.social', '.comment', '.comments', '.related',
    '#nav', '#navigation', '#menu', '#sidebar', '#footer', '#header',
]

// Block-level elements that typically contain content
const BLOCK_SELECTORS = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'li', 'td', 'th', 'blockquote', 'figcaption',
    'article', 'section', 'main',
]

// Inline elements that should be preserved within text
const INLINE_TAGS = new Set([
    'A', 'B', 'I', 'U', 'S', 'EM', 'STRONG', 'SPAN', 'MARK',
    'SUB', 'SUP', 'SMALL', 'BIG', 'ABBR', 'CITE', 'Q',
])

/**
 * Parse document and return translatable blocks
 */
export function parseDocument(root: Element = document.body): TranslatableBlock[] {
    const blocks: TranslatableBlock[] = []
    const candidates = root.querySelectorAll(BLOCK_SELECTORS.join(','))

    for (const element of candidates) {
        const el = element as HTMLElement

        // Skip already translated
        if (el.hasAttribute('data-immersive-translated')) continue

        // Skip if inside excluded container
        if (isInsideExcludedContainer(el)) continue

        // Skip if element should be skipped
        if (shouldSkipElement(el)) continue

        // Calculate content score
        const score = calculateBlockScore(el)
        if (score < 0.3) continue  // Low quality content

        // Tokenize text with tag preservation
        const tokens = tokenizeElement(el)
        if (tokens.raw.length < 5) continue  // Too short

        blocks.push({
            element: el,
            text: tokens.raw,
            tokens,
            score,
        })
    }

    // Sort by document order
    return blocks
}

/**
 * Check if element is inside an excluded container
 */
function isInsideExcludedContainer(el: HTMLElement): boolean {
    return el.closest(EXCLUDE_SELECTORS.join(',')) !== null
}

/**
 * Check if element should be skipped entirely
 */
function shouldSkipElement(el: HTMLElement): boolean {
    // Check tag name
    if (SKIP_TAGS.has(el.tagName)) return true

    // Check if hidden
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return true

    // Check for data attributes that indicate non-content
    if (el.getAttribute('aria-hidden') === 'true') return true
    if (el.getAttribute('data-nosnippet') !== null) return true

    return false
}

/**
 * Calculate a quality score for a block element
 * Higher score = more likely to be main content
 */
function calculateBlockScore(el: HTMLElement): number {
    const text = el.textContent || ''
    const textLength = text.trim().length

    if (textLength === 0) return 0

    let score = 0.5  // Base score

    // Text density: ratio of text to HTML
    const htmlLength = el.innerHTML.length
    const textDensity = textLength / htmlLength
    score += textDensity * 0.3

    // Link density: ratio of link text to total text
    const links = el.querySelectorAll('a')
    let linkTextLength = 0
    links.forEach(a => linkTextLength += (a.textContent || '').length)
    const linkDensity = linkTextLength / textLength
    score -= linkDensity * 0.4  // High link density is bad

    // Punctuation score: content usually has punctuation
    const punctuationCount = (text.match(/[.!?。！？，,;；:：]/g) || []).length
    const punctuationDensity = punctuationCount / (textLength / 100)
    score += Math.min(punctuationDensity * 0.1, 0.2)

    // Paragraph-like elements get bonus
    if (['P', 'ARTICLE', 'SECTION'].includes(el.tagName)) {
        score += 0.1
    }

    // Short text penalty
    if (textLength < 50) {
        score -= 0.2
    }

    return Math.max(0, Math.min(1, score))
}

/**
 * Tokenize element content, preserving inline tags as placeholders
 */
export function tokenizeElement(el: HTMLElement): TokenizedText {
    const segments: TextSegment[] = []
    let tagIndex = 0
    const tagMap = new Map<number, string>()

    function processNode(node: Node): void {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || ''
            if (text.trim()) {
                segments.push({ type: 'text', content: text })
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement

            if (SKIP_TAGS.has(element.tagName)) {
                // Skip entirely
                return
            }

            if (INLINE_TAGS.has(element.tagName)) {
                // Preserve inline tag as placeholder
                const idx = tagIndex++
                tagMap.set(idx, element.outerHTML)

                // Add opening placeholder
                segments.push({
                    type: 'tag',
                    content: `{{${idx}:start}}`,
                    tagIndex: idx,
                })

                // Process children
                for (const child of element.childNodes) {
                    processNode(child)
                }

                // Add closing placeholder
                segments.push({
                    type: 'tag',
                    content: `{{${idx}:end}}`,
                    tagIndex: idx,
                })
            } else {
                // Process children directly
                for (const child of element.childNodes) {
                    processNode(child)
                }
            }
        }
    }

    for (const child of el.childNodes) {
        processNode(child)
    }

    // Build raw text for translation (simplified - just text with placeholders)
    const raw = segments
        .map(s => s.type === 'text' ? s.content : '')
        .join('')
        .trim()

    return { raw, segments }
}

/**
 * Restore tags in translated text
 */
export function restoreTagsInTranslation(
    _originalTokens: TokenizedText,
    translatedText: string
): string {
    // For MVP, return translated text as-is
    // TODO: Implement smart tag restoration
    return translatedText
}

/**
 * Check if text appears to be in a foreign language
 * Simple heuristic based on character ranges
 */
export function detectLanguage(text: string): 'zh' | 'ja' | 'ko' | 'en' | 'other' {
    // Count character types
    let cjk = 0
    let latin = 0
    let other = 0

    for (const char of text) {
        const code = char.charCodeAt(0)

        // CJK ranges
        if ((code >= 0x4E00 && code <= 0x9FFF) ||  // CJK Unified
            (code >= 0x3400 && code <= 0x4DBF)) {   // CJK Extension A
            cjk++
        }
        // Hiragana/Katakana
        else if ((code >= 0x3040 && code <= 0x309F) ||
            (code >= 0x30A0 && code <= 0x30FF)) {
            return 'ja'
        }
        // Hangul
        else if (code >= 0xAC00 && code <= 0xD7AF) {
            return 'ko'
        }
        // Latin
        else if ((code >= 0x0041 && code <= 0x007A) ||
            (code >= 0x00C0 && code <= 0x00FF)) {
            latin++
        } else {
            other++
        }
    }

    const total = cjk + latin + other
    if (total === 0) return 'other'

    if (cjk / total > 0.3) return 'zh'
    if (latin / total > 0.5) return 'en'

    return 'other'
}
