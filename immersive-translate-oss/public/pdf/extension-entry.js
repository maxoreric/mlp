
let pdfReady = false;

function main() {
    globalThis.addEventListener("message", listenMessage);
    const iframe = document.querySelector("iframe");
    // read the file param
    const urlObj = new URL(window.location.href);
    let filePath = urlObj.searchParams.get("file");

    // Don't call restorePdf when no file - just hide loading and let manual upload work
    if (!filePath) {
        hiddenLoading();
        // Continue to set up manual upload handler below
    }

    // Handle file:// protocol specially - only if filePath exists
    if (filePath) {
        let fileIndex = filePath.indexOf("file:///");
        if (fileIndex < 0) fileIndex = filePath.indexOf("http://");
        if (fileIndex < 0) fileIndex = filePath.indexOf("https://");

        if (fileIndex > 0) {
            filePath = filePath.slice(fileIndex);
        }

        // Fetch local file content as blob and send to viewer
        fetch(filePath).then((response) => {
            return response.blob();
        })
            .then((blob) => {
                waitIframeLoad().then(function () {
                    iframe.contentWindow.postMessage({
                        type: "pdf-local-file",
                        blob: blob,
                        fileName: getDecodedFileName(filePath),
                    }, "*");
                });
            }).catch(function (err) {
                console.error("[Immersive Translate] Fetch error:", err);
                hiddenLoading();
            });
    }

    function getDecodedFileName(url) {
        try {
            if (!url) return "document.pdf";
            const encodedFileName = url.split("/").pop();
            return decodeURIComponent(encodedFileName);
        } catch (e) {
            return "document.pdf";
        }
    }

    // Manual File Upload Handler - ALWAYS set up
    const fileInput = document.getElementById("fileInput");
    const openFileBtn = document.getElementById("openFileBtn");

    console.log("[Immersive Translate] Manual Handler Init", { openFileBtn, fileInput });

    if (openFileBtn && fileInput) {
        openFileBtn.addEventListener("click", () => {
            console.log("[Immersive Translate] Button clicked, triggering file input");
            fileInput.click();
        });

        fileInput.addEventListener("change", (e) => {
            console.log("[Immersive Translate] File selected", e.target.files);
            const file = e.target.files[0];
            if (!file) return;

            openFileBtn.style.display = 'none'; // Hide button after selection

            // Send blob to viewer
            waitIframeLoad().then(function () {
                console.log("[Immersive Translate] Sending blob to viewer");
                iframe.contentWindow.postMessage({
                    type: "pdf-local-file",
                    blob: file,
                    fileName: file.name,
                }, "*");
            });
        });
    } else {
        console.error("[Immersive Translate] Button or file input not found!", { openFileBtn, fileInput });
    }
}

function waitIframeLoad() {
    return new Promise(function (resolve, reject) {
        if (pdfReady) return resolve();

        // Set a timeout in case the viewer doesn't reply
        const timeout = setTimeout(() => {
            console.log("[Immersive Translate] Timeout waiting for pdf-ready, proceeding anyway");
            resolve(); // proceed anyway
        }, 3000);

        function listenMessageLocal(event) {
            if (event.data && event.data.type == "pdf-ready") {
                console.log("[Immersive Translate] Received pdf-ready");
                clearTimeout(timeout);
                globalThis.removeEventListener("message", listenMessageLocal);
                return resolve();
            }
        }
        globalThis.addEventListener("message", listenMessageLocal);
    });
}

function injectSideBySideLayout() {
    const iframe = document.querySelector("iframe");
    try {
        const doc = iframe.contentDocument;
        // Check if already injected
        if (doc.getElementById("immersive-translate-side-panel")) return;

        // 1. Resize PDF Container
        const style = doc.createElement("style");
        style.id = "immersive-translate-style";
        style.textContent = `
       /* Resize original PDF viewer to left 50% */
       #outerContainer {
         width: 50% !important;
         right: auto !important;
         left: 0 !important;
         border-right: 1px solid #e5e7eb;
       }
       
       /* Side Panel for Translation */
       #immersive-translate-side-panel {
         position: fixed;
         top: 0;
         right: 0;
         width: 50%;
         height: 100%;
         background: #fafafa;
         overflow-y: auto;
         z-index: 9999;
         box-sizing: border-box;
         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
       }
       
       .immersive-translate-header {
         position: sticky;
         top: 0;
         background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
         color: white;
         padding: 16px 20px;
         font-weight: 600;
         font-size: 14px;
         z-index: 10;
         display: flex;
         align-items: center;
         justify-content: space-between;
       }
       
       .immersive-translate-content {
         padding: 20px;
       }
       
       .immersive-translate-paragraph {
         margin-bottom: 16px;
         padding: 16px;
         background: white;
         border-radius: 8px;
         box-shadow: 0 1px 3px rgba(0,0,0,0.1);
       }
       
       .immersive-translate-page-marker {
         font-size: 11px;
         color: #9ca3af;
         margin-bottom: 8px;
         font-weight: 500;
       }
       
       .immersive-translate-original {
         color: #6b7280;
         font-size: 13px;
         line-height: 1.6;
         margin-bottom: 8px;
         padding-bottom: 8px;
         border-bottom: 1px dashed #e5e7eb;
       }
       
       .immersive-translate-translation {
         color: #1f2937;
         font-size: 14px;
         line-height: 1.7;
       }
       
       .immersive-translate-loading {
         text-align: center;
         padding: 40px;
         color: #9ca3af;
       }
       
       .immersive-translate-spinner {
         width: 32px;
         height: 32px;
         border: 3px solid #e5e7eb;
         border-top-color: #667eea;
         border-radius: 50%;
         animation: spin 1s linear infinite;
         margin: 0 auto 16px;
       }
       
       @keyframes spin {
         to { transform: rotate(360deg); }
       }
     `;
        doc.head.appendChild(style);

        // 2. Create Side Panel
        const panel = doc.createElement("div");
        panel.id = "immersive-translate-side-panel";
        panel.innerHTML = `
        <div class="immersive-translate-header">
           <span>📖 Translation View</span>
           <span id="immersive-translate-status">Extracting text...</span>
        </div>
        <div class="immersive-translate-content" id="immersive-translate-content">
           <div class="immersive-translate-loading">
              <div class="immersive-translate-spinner"></div>
              <div>Extracting PDF text...</div>
           </div>
        </div>
     `;
        doc.body.appendChild(panel);

        console.log("[Immersive Translate] Side-by-side layout injected");

    } catch (e) {
        console.error("[Immersive Translate] Failed to inject layout:", e);
    }
}

async function translateParagraphs(paragraphs) {
    const iframe = document.querySelector("iframe");
    const doc = iframe.contentDocument;
    const contentDiv = doc.getElementById("immersive-translate-content");
    const statusSpan = doc.getElementById("immersive-translate-status");

    if (!contentDiv) return;

    // Update status
    if (statusSpan) {
        statusSpan.textContent = `Translating ${paragraphs.length} paragraphs...`;
    }

    // Clear loading state
    contentDiv.innerHTML = "";

    // Get config from background
    let config = null;
    try {
        config = await chrome.runtime.sendMessage({ action: 'GET_CONFIG' });
        if (config && config.success) {
            config = config.data;
        }
    } catch (e) {
        console.error("[Immersive Translate] Failed to get config:", e);
    }

    // Batch translate - send to background script
    const textsToTranslate = paragraphs.map(p => p.text);

    let translations = [];
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'TRANSLATE_BATCH',
            data: {
                texts: textsToTranslate,
                sourceLang: 'en',
                targetLang: config?.targetLanguage || 'zh-CN'
            }
        });

        if (response && response.success) {
            translations = response.data;
        } else {
            throw new Error(response?.error || 'Translation failed');
        }
    } catch (e) {
        console.error("[Immersive Translate] Translation error:", e);
        // Show original text without translation
        translations = textsToTranslate.map(() => "(Translation unavailable)");
    }

    // Render paragraphs with translations
    let currentPage = 0;
    for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        const translation = translations[i] || "(Translation pending...)";

        const div = document.createElement("div");
        div.className = "immersive-translate-paragraph";

        // Add page marker if page changed
        let pageMarkerHtml = "";
        if (p.pageNum !== currentPage) {
            currentPage = p.pageNum;
            pageMarkerHtml = `<div class="immersive-translate-page-marker">📄 Page ${p.pageNum}</div>`;
        }

        div.innerHTML = `
            ${pageMarkerHtml}
            <div class="immersive-translate-original">${escapeHtml(p.text)}</div>
            <div class="immersive-translate-translation">${escapeHtml(translation)}</div>
        `;
        contentDiv.appendChild(div);
    }

    // Update status
    if (statusSpan) {
        statusSpan.textContent = `✓ ${paragraphs.length} paragraphs translated`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function listenMessage(event) {
    const data = event.data;
    if (!data) return;

    if (data.type == "pdf-ready") {
        pdfReady = true;
        // Inject layout when PDF viewer is ready
        injectSideBySideLayout();
    }

    if (data.type == "pdf-loaded") {
        hiddenLoading();
    }

    if (data.type == "pdf-text-extracted") {
        console.log("[Immersive Translate] Received extracted text:", data.paragraphs?.length, "paragraphs");
        translateParagraphs(data.paragraphs || []);
    }

    if (data.type == "update-title") {
        document.title = data.title;
    }
}

function hiddenLoading() {
    const ele = document.getElementById("loading");
    if (!ele) return;
    ele.style.display = "none";
}

main();
