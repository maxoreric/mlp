// Immersive Translate Bridge
// This script runs inside the PDF.js viewer iframe
(function () {
    console.log("[Immersive Translate] Bridge: Script loaded");

    // Immediately set up message listener - don't wait for PDF.js
    window.addEventListener("message", function (e) {
        console.log("[Immersive Translate] Bridge: Received message", e.data?.type);

        if (e.data && e.data.type === "pdf-local-file") {
            handlePdfLoad(e.data);
        }

        if (e.data && e.data.type === "extract-text") {
            extractTextFromPdf();
        }
    });

    // Send pdf-ready immediately
    console.log("[Immersive Translate] Bridge: Sending pdf-ready to parent");
    window.parent.postMessage({ type: "pdf-ready" }, "*");

    function handlePdfLoad(data) {
        console.log("[Immersive Translate] Bridge: Received pdf-local-file, fileName:", data.fileName);

        const blob = data.blob;

        // Read the blob/file as ArrayBuffer - PDF.js needs { data: ArrayBuffer }
        const reader = new FileReader();
        reader.onload = function (event) {
            const arrayBuffer = event.target.result;
            console.log("[Immersive Translate] Bridge: File read as ArrayBuffer, size:", arrayBuffer.byteLength);

            // Wait for PDFViewerApplication to be ready before opening
            waitForPDFViewer().then(() => {
                console.log("[Immersive Translate] Bridge: PDFViewerApplication ready, opening with data");
                window.PDFViewerApplication.open({ data: arrayBuffer }).then(() => {
                    console.log("[Immersive Translate] Bridge: PDF opened successfully");
                    // Update document title
                    document.title = data.fileName || "PDF Document";
                    window.parent.postMessage({ type: "pdf-loaded" }, "*");

                    // Auto-extract text after PDF is loaded
                    setTimeout(() => {
                        extractTextFromPdf();
                    }, 1000); // Wait a bit for text layer to render

                }).catch(err => {
                    console.error("[Immersive Translate] PDF Open Error:", err);
                });
            });
        };
        reader.onerror = function (err) {
            console.error("[Immersive Translate] Bridge: FileReader error:", err);
        };
        reader.readAsArrayBuffer(blob);
    }

    async function extractTextFromPdf() {
        console.log("[Immersive Translate] Bridge: Starting text extraction");

        try {
            const pdfDoc = window.PDFViewerApplication.pdfDocument;
            if (!pdfDoc) {
                console.error("[Immersive Translate] Bridge: No PDF document loaded");
                return;
            }

            const numPages = pdfDoc.numPages;
            console.log("[Immersive Translate] Bridge: PDF has", numPages, "pages");

            const allParagraphs = [];

            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                const page = await pdfDoc.getPage(pageNum);
                const textContent = await page.getTextContent();

                // Group text items into paragraphs
                const paragraphs = groupTextIntoParagraphs(textContent.items, pageNum);
                allParagraphs.push(...paragraphs);
            }

            console.log("[Immersive Translate] Bridge: Extracted", allParagraphs.length, "paragraphs");

            // Send extracted text to parent for translation
            window.parent.postMessage({
                type: "pdf-text-extracted",
                paragraphs: allParagraphs
            }, "*");

        } catch (err) {
            console.error("[Immersive Translate] Bridge: Text extraction error:", err);
        }
    }

    function groupTextIntoParagraphs(items, pageNum) {
        const paragraphs = [];
        let currentParagraph = {
            text: "",
            pageNum: pageNum,
            items: []
        };

        let lastY = null;
        const LINE_THRESHOLD = 12; // Pixels threshold to detect new line
        const PARAGRAPH_THRESHOLD = 20; // Pixels threshold to detect new paragraph

        for (const item of items) {
            if (!item.str || item.str.trim() === "") continue;

            const y = item.transform[5]; // Y position

            if (lastY !== null) {
                const yDiff = Math.abs(lastY - y);

                if (yDiff > PARAGRAPH_THRESHOLD) {
                    // New paragraph
                    if (currentParagraph.text.trim()) {
                        paragraphs.push({
                            text: currentParagraph.text.trim(),
                            pageNum: currentParagraph.pageNum
                        });
                    }
                    currentParagraph = {
                        text: item.str,
                        pageNum: pageNum,
                        items: [item]
                    };
                } else if (yDiff > LINE_THRESHOLD) {
                    // New line within paragraph
                    currentParagraph.text += " " + item.str;
                    currentParagraph.items.push(item);
                } else {
                    // Same line
                    currentParagraph.text += item.str;
                    currentParagraph.items.push(item);
                }
            } else {
                currentParagraph.text = item.str;
                currentParagraph.items.push(item);
            }

            lastY = y;
        }

        // Don't forget the last paragraph
        if (currentParagraph.text.trim()) {
            paragraphs.push({
                text: currentParagraph.text.trim(),
                pageNum: currentParagraph.pageNum
            });
        }

        return paragraphs;
    }

    // Helper function to wait for PDFViewerApplication
    function waitForPDFViewer() {
        return new Promise((resolve) => {
            if (window.PDFViewerApplication && window.PDFViewerApplication.initializedPromise) {
                console.log("[Immersive Translate] Bridge: PDFViewerApplication already exists");
                window.PDFViewerApplication.initializedPromise.then(resolve);
                return;
            }

            console.log("[Immersive Translate] Bridge: Polling for PDFViewerApplication");
            let checks = 0;
            const interval = setInterval(() => {
                checks++;
                if (window.PDFViewerApplication && window.PDFViewerApplication.initializedPromise) {
                    console.log("[Immersive Translate] Bridge: PDFViewerApplication found after", checks * 100, "ms");
                    clearInterval(interval);
                    window.PDFViewerApplication.initializedPromise.then(resolve);
                } else if (checks > 100) { // 10 seconds max
                    console.error("[Immersive Translate] Bridge: Timeout waiting for PDFViewerApplication");
                    clearInterval(interval);
                    if (window.PDFViewerApplication) {
                        resolve();
                    }
                }
            }, 100);
        });
    }
})();
