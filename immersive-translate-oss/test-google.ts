
import { GoogleTranslateAdapter } from './src/services/translator/google';

async function testGoogle() {
    const adapter = new GoogleTranslateAdapter();
    try {
        console.log("Testing Google Translate Adapter...");
        const result = await adapter.translate(['Hello world'], 'en', 'zh-CN');
        console.log("Result:", result);
    } catch (e) {
        console.error("Translation Failed:", e);
    }
}

testGoogle();
