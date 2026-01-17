/**
 * Universal Network Hook for Subtitle Interception
 * Runs in Main World. Intercepts fetch/XHR to capture subtitle data passively.
 */

interface SubtitleData {
    source: 'youtube' | 'bilibili';
    format: 'json' | 'xml' | 'vtt';
    url: string;
    body?: any;
    text?: string;
}

(function () {
    console.log('[Immersive Translate] Network Hook initialized');

    const ORIGINAL_FETCH = window.fetch;
    const ORIGINAL_XHR_OPEN = XMLHttpRequest.prototype.open;
    const ORIGINAL_XHR_SEND = XMLHttpRequest.prototype.send;

    // --- Helper: Identify Subtitle Requests ---
    function identifyRequest(url: string): { isMatch: boolean; source?: 'youtube' | 'bilibili' } {
        if (!url) return { isMatch: false };

        // YouTube: api/timedtext
        if (url.includes('/api/timedtext')) {
            return { isMatch: true, source: 'youtube' };
        }

        // Bilibili: x/player/v2 or similar subtitle endpoints
        // Note: Bilibili often loads subtitles via specific JSON endpoints
        if (url.includes('api.bilibili.com/x/player/v2') || url.includes('subtitle_url')) {
            return { isMatch: true, source: 'bilibili' };
        }

        return { isMatch: false };
    }

    function broadcast(data: SubtitleData) {
        window.postMessage({
            type: 'IMMERSIVE_INTERCEPTED_SUBTITLE',
            data: data
        }, '*');
    }

    // --- Hook Fetch ---
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);

        const { isMatch, source } = identifyRequest(url);

        const response = await ORIGINAL_FETCH(input, init);

        if (isMatch && response.ok) {
            try {
                // Clone response to read body without consuming original
                const clone = response.clone();
                const text = await clone.text();

                let body: any;
                let format: 'json' | 'xml' = 'json';

                try {
                    body = JSON.parse(text);
                } catch {
                    format = 'xml';
                    body = text;
                }

                if (source === 'youtube') {
                    // Start filtering: only care about actual subtitle data
                    // If XML, we might not handle it yet (my youtube.ts expects JSON)
                    // But at least we won't crash the hook.
                    broadcast({ source, format, url, body });
                } else if (source === 'bilibili') {
                    broadcast({ source, format, url, body });
                }
            } catch (err) {
                console.error('[Immersive Translate] Failed to process intercepted fetch:', err);
            }
        }

        return response;
    };

    // --- Hook XHR ---
    // Note: Most modern players use fetch, but some legacy or specific calls might use XHR.
    // We hook it just in case, similar to the target extension.
    XMLHttpRequest.prototype.open = function (_method: string, url: string | URL) {
        // @ts-ignore
        this._url = typeof url === 'string' ? url : url.href;
        // @ts-ignore
        return ORIGINAL_XHR_OPEN.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (_body?: Document | XMLHttpRequestBodyInit | null) {
        this.addEventListener('load', () => {
            // @ts-ignore
            const url = this._url;
            const { isMatch, source } = identifyRequest(url);

            if (isMatch && this.status === 200) {
                try {
                    const responseText = this.responseText;
                    // Try parsing JSON
                    try {
                        const data = JSON.parse(responseText);
                        broadcast({ source: source!, format: 'json', url, body: data });
                    } catch {
                        broadcast({ source: source!, format: 'xml', url, text: responseText });
                    }
                } catch (e) {
                    console.error('[Immersive Translate] XHR Intercept Error', e);
                }
            }
        });

        // @ts-ignore
        return ORIGINAL_XHR_SEND.apply(this, arguments);
    };

})();
