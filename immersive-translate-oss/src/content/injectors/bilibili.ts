/**
 * Bilibili Main World Injector
 * Runs in the Main World to access window objects blocked by CSP in Isolated World
 */

(function () {
    console.log('[Immersive Translate] Bilibili Injector running...');

    function postData() {
        try {
            // @ts-ignore
            const state = window.__INITIAL_STATE__;
            if (state?.videoData?.cid) {
                console.log('[Immersive Translate] Found Bilibili CID:', state.videoData.cid);
                window.postMessage({
                    type: 'IMMERSIVE_BILIBILI_CID',
                    cid: state.videoData.cid
                }, '*');
                return true;
            }
        } catch (e) {
            console.error('[Immersive Translate] Error accessing Bilibili data:', e);
        }
        return false;
    }

    // Attempt immediately
    if (!postData()) {
        const interval = setInterval(() => {
            if (postData()) {
                clearInterval(interval);
            }
        }, 500);

        setTimeout(() => clearInterval(interval), 10000);
    }
})();
