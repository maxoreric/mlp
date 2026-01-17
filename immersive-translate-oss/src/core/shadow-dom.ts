/**
 * Shadow DOM Helper
 * Provides style-isolated containers for translation UI
 */

export interface TranslationUIOptions {
  style?: 'block' | 'underline' | 'blur' | 'sense'
  fontSize?: string
  color?: string
}

const DEFAULT_STYLES = `
  :host {
    display: block;
    margin-top: 8px;
  }
  
  .translation-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  /* Block style (default) */
  .style-block .translation-text {
    color: #64748b;
    font-size: 0.95em;
    line-height: 1.6;
    border-left: 3px solid #0ea5e9;
    padding-left: 12px;
    margin-top: 4px;
    background: rgba(14, 165, 233, 0.05);
    padding: 8px 12px;
    border-radius: 0 4px 4px 0;
  }
  
  /* Underline style */
  .style-underline .translation-text {
    color: #64748b;
    font-size: 0.85em;
    border-bottom: 1px dashed #94a3b8;
    display: inline;
  }
  
  /* Blur style (for learning) */
  .style-blur .translation-text {
    color: #64748b;
    font-size: 0.95em;
    filter: blur(4px);
    transition: filter 0.2s ease;
  }
  
  .style-blur .translation-text:hover {
    filter: blur(0);
  }
  
  /* Loading state */
  .loading {
    color: #94a3b8;
    font-style: italic;
  }
  
  .loading::after {
    content: '';
    animation: dots 1.5s infinite;
  }
  
  @keyframes dots {
    0%, 20% { content: '.'; }
    40% { content: '..'; }
    60%, 100% { content: '...'; }
  }
  
  /* Sense Group style */
  .style-sense .translation-text {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: flex-start;
    line-height: 1.5;
  }

  .sense-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(100, 116, 139, 0.05);
    border-radius: 4px;
    padding: 2px 4px;
  }

  .sense-src {
    font-size: 1em;
    color: #334155;
    font-weight: 500;
  }

  .sense-tgt {
    font-size: 0.85em;
    color: #64748b;
    margin-top: 2px;
  }

  /* Error state */
  .error {
    color: #ef4444;
    font-size: 0.85em;
  }
`

/**
 * Create a Shadow DOM container for translation UI
 */
export function createTranslationContainer(
  options: TranslationUIOptions = {}
): { wrapper: HTMLElement; shadow: ShadowRoot; content: HTMLElement } {
  const wrapper = document.createElement('immersive-translate-wrapper')
  wrapper.setAttribute('data-immersive-translate', 'true')

  const shadow = wrapper.attachShadow({ mode: 'open' })

  // Inject styles
  const style = document.createElement('style')
  style.textContent = DEFAULT_STYLES
  shadow.appendChild(style)

  // Create container
  const container = document.createElement('div')
  container.className = `translation-container style-${options.style || 'block'}`

  // Create content element
  const content = document.createElement('div')
  content.className = 'translation-text loading'
  content.textContent = '翻译中'

  container.appendChild(content)
  shadow.appendChild(container)

  return { wrapper, shadow, content }
}

/**
 * Update translation content
 */
export function updateTranslationContent(
  content: HTMLElement,
  text: string,
  isError = false
): void {
  content.className = isError ? 'translation-text error' : 'translation-text'

  if (!isError) {
    try {
      // Extract JSON from text (may have markdown code blocks or extra text)
      const jsonText = extractJsonFromText(text)

      // Only attempt parse if it looks like object/array
      // Relaxed check: do not require .style-sense parent, specifically for Z.AI streaming behavior
      if (jsonText.startsWith('{') || jsonText.startsWith('[')) {
        const data = JSON.parse(jsonText)

        // Handle both flat array [{src, tgt}, ...] and nested [[{src, tgt}, ...]]
        let items: Array<{ src: string, tgt: string }> = []
        if (Array.isArray(data)) {
          if (data.length > 0 && Array.isArray(data[0])) {
            // Nested array: flatten first level
            items = data.flat()
          } else if (data.length > 0 && (data[0].src || data[0].tgt)) {
            // Flat array
            items = data
          }
        } else if (typeof data === 'object' && data !== null) {
          // Single object
          if (data.src || data.tgt) {
            items = [data]
          }
        }

        if (items.length > 0) {
          content.innerHTML = items.map((item: any) => `
              <div class="sense-block">
                <div class="sense-src">${escapeHtml(item.src || '')}</div>
                <div class="sense-tgt">${escapeHtml(item.tgt || '')}</div>
              </div>
            `).join('')
          return
        }
      }
    } catch (e) {
      // Fallback to plain text if parsing fails
      // console.warn('[Sense Group] Failed to parse:', e)
    }
  }

  content.textContent = text
}

/**
 * Extract JSON from text that may contain markdown or extra content
 */
function extractJsonFromText(text: string): string {
  // Remove markdown code blocks
  const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeMatch) return codeMatch[1].trim()

  // Find JSON array or object
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
  if (jsonMatch) return jsonMatch[1]

  return text.trim()
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Inject translation UI after an element
 */
export function injectTranslationUI(
  targetElement: HTMLElement,
  options: TranslationUIOptions = {}
): { wrapper: HTMLElement; content: HTMLElement } {
  const { wrapper, content } = createTranslationContainer(options)

  // Mark original element as translated
  targetElement.setAttribute('data-immersive-translated', 'true')

  // Insert after target
  targetElement.parentNode?.insertBefore(wrapper, targetElement.nextSibling)

  return { wrapper, content }
}

/**
 * Remove all translation UI from the page
 */
export function removeAllTranslations(): void {
  // Remove wrappers
  document.querySelectorAll('immersive-translate-wrapper').forEach(el => el.remove())

  // Remove translated markers
  document.querySelectorAll('[data-immersive-translated]').forEach(el => {
    el.removeAttribute('data-immersive-translated')
  })
}

/**
 * Toggle translation visibility
 */
export function toggleTranslations(visible: boolean): void {
  document.querySelectorAll('immersive-translate-wrapper').forEach(el => {
    (el as HTMLElement).style.display = visible ? 'block' : 'none'
  })
}
