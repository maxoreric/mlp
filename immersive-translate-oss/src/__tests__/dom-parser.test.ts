/**
 * Unit tests for DOM Parser
 */

import {
    parseDocument,
    tokenizeElement,
    detectLanguage
} from '@/core/dom-parser'

// Mock document.body for tests


describe('DOM Parser', () => {
    describe('detectLanguage', () => {
        it('should detect English text', () => {
            expect(detectLanguage('Hello, this is a test sentence.')).toBe('en')
        })

        it('should detect Chinese text', () => {
            expect(detectLanguage('这是一个测试句子。')).toBe('zh')
        })

        it('should detect Japanese text', () => {
            expect(detectLanguage('これはテストです。')).toBe('ja')
        })

        it('should detect Korean text', () => {
            expect(detectLanguage('이것은 테스트입니다.')).toBe('ko')
        })

        it('should handle mixed content', () => {
            // Primarily English
            expect(detectLanguage('Hello 你好 World')).toBe('en')
        })
    })

    describe('tokenizeElement', () => {
        it('should extract text from simple element', () => {
            const div = document.createElement('div')
            div.innerHTML = 'Hello World'

            const result = tokenizeElement(div)
            expect(result.raw).toBe('Hello World')
        })

        it('should handle inline tags', () => {
            const div = document.createElement('div')
            div.innerHTML = 'Hello <b>World</b>!'

            const result = tokenizeElement(div)
            expect(result.raw).toContain('Hello')
            expect(result.raw).toContain('World')
        })

        it('should skip script tags', () => {
            const div = document.createElement('div')
            div.innerHTML = 'Hello <script>alert("test")</script> World'

            const result = tokenizeElement(div)
            expect(result.raw).not.toContain('alert')
        })
    })

    describe('parseDocument', () => {
        it('should find paragraph elements', () => {
            document.body.innerHTML = `
        <article>
          <p>This is a test paragraph with enough content to be considered valid.</p>
          <p>Another paragraph with sufficient length for translation.</p>
        </article>
      `

            const blocks = parseDocument()
            expect(blocks.length).toBeGreaterThan(0)
        })

        it('should skip navigation elements', () => {
            document.body.innerHTML = `
        <nav>
          <p>Navigation link text that should be excluded</p>
        </nav>
        <main>
          <p>Main content paragraph with enough text.</p>
        </main>
      `

            const blocks = parseDocument()
            const navContent = blocks.some(b => b.text.includes('Navigation'))
            expect(navContent).toBe(false)
        })

        it('should skip already translated elements', () => {
            document.body.innerHTML = `
        <p data-immersive-translated="true">Already translated content.</p>
        <p>New content to translate with enough length.</p>
      `

            const blocks = parseDocument()
            const alreadyTranslated = blocks.some(b => b.text.includes('Already translated'))
            expect(alreadyTranslated).toBe(false)
        })
    })
})
