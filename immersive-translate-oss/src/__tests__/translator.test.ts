/**
 * Tests for Translation Service
 */

import { translateWithAdapter } from '@/services/translator'
import { TranslationServiceConfig } from '@/types/config'
import { TranslationError } from '@/services/translator/adapter.interface'

// Mock adapters
jest.mock('@/services/translator/google', () => {
    return {
        GoogleTranslateAdapter: jest.fn().mockImplementation(() => ({
            translate: jest.fn().mockResolvedValue(['Translated Text']),
        })),
    }
})

jest.mock('@/services/translator/openai', () => {
    return {
        OpenAIAdapter: jest.fn().mockImplementation(() => ({
            translate: jest.fn().mockResolvedValue(['Translated Text']),
        })),
    }
})

describe('Translation Service', () => {
    const mockTexts = ['Hello']
    const sourceLang = 'en'
    const targetLang = 'zh-CN'

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should use Google adapter by default', async () => {
        const config: TranslationServiceConfig = {
            type: 'google',
            model: '',
        }

        const { GoogleTranslateAdapter } = require('@/services/translator/google')

        await translateWithAdapter(mockTexts, sourceLang, targetLang, config)

        expect(GoogleTranslateAdapter).toHaveBeenCalled()
    })

    it('should use OpenAI adapter when configured', async () => {
        const config: TranslationServiceConfig = {
            type: 'openai',
            apiKey: 'test-key',
            model: 'gpt-3.5-turbo',
        }

        const { OpenAIAdapter } = require('@/services/translator/openai')

        await translateWithAdapter(mockTexts, sourceLang, targetLang, config)

        expect(OpenAIAdapter).toHaveBeenCalled()
    })

    it('should throw error if API key is missing for OpenAI', async () => {
        const config: TranslationServiceConfig = {
            type: 'openai',
            model: 'gpt-3.5-turbo',
            // apiKey missing
        }

        await expect(
            translateWithAdapter(mockTexts, sourceLang, targetLang, config)
        ).rejects.toThrow('API key is required')
    })

    it('should retry on failure', async () => {
        const config: TranslationServiceConfig = {
            type: 'google',
            model: '',
        }

        // Mock implementation that fails twice then succeeds
        const mockTranslate = jest.fn()
            .mockRejectedValueOnce(new Error('Network error'))
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValue(['Success'])

        const { GoogleTranslateAdapter } = require('@/services/translator/google')
        GoogleTranslateAdapter.mockImplementation(() => ({
            translate: mockTranslate,
        }))

        const result = await translateWithAdapter(mockTexts, sourceLang, targetLang, config)

        expect(result).toEqual(['Success'])
        expect(mockTranslate).toHaveBeenCalledTimes(3)
    })

    it('should not retry on non-retryable error', async () => {
        const config: TranslationServiceConfig = {
            type: 'google',
            model: '',
        }

        // Mock non-retryable error
        const nonRetryableError = new TranslationError('Invalid Request', false)
        const mockTranslate = jest.fn().mockRejectedValue(nonRetryableError)

        const { GoogleTranslateAdapter } = require('@/services/translator/google')
        GoogleTranslateAdapter.mockImplementation(() => ({
            translate: mockTranslate,
        }))

        await expect(
            translateWithAdapter(mockTexts, sourceLang, targetLang, config)
        ).rejects.toThrow('Invalid Request')

        expect(mockTranslate).toHaveBeenCalledTimes(1)
    })
})
