/**
 * YouTube Main World Injector
 * Runs in the Main World to access window objects blocked by CSP in Isolated World
 */

// Define types for window objects
interface Window {
    ytInitialPlayerResponse: any;
    yt: any;
}

(function () {
    console.log('[Immersive Translate] YouTube Injector running...');

    function postData() {
        try {
            // @ts-ignore
            const data = window.ytInitialPlayerResponse;
            if (data) {
                console.log('[Immersive Translate] Found ytInitialPlayerResponse');
                window.postMessage({
                    type: 'IMMERSIVE_YOUTUBE_DATA',
                    data: data
                }, '*');
                return true;
            }
        } catch (e) {
            console.error('[Immersive Translate] Error accessing YT data:', e);
        }
        return false;
    }

    // Attempt immediately
    if (!postData()) {
        // Retry logic for late loading
        const interval = setInterval(() => {
            if (postData()) {
                clearInterval(interval);
            }
        }, 500);

        // Stop after 10 seconds
        setTimeout(() => clearInterval(interval), 10000);
    }
})();
