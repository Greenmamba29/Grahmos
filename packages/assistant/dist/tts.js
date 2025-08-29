import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
/**
 * Main TTS function that routes to appropriate TTS provider
 * Defaults to Piper (OSS) with fallbacks to other providers
 */
export async function textToSpeech(text, outputPath, options = {}) {
    const engine = options.engine || (process.env.TTS_ENGINE || 'piper').toLowerCase();
    try {
        switch (engine) {
            case 'piper':
                return await piperTTS(text, outputPath, options);
            case 'coqui':
                return await coquiTTS(text, outputPath, options);
            case 'openai':
                return await openaiTTS(text, outputPath, options);
            case 'elevenlabs':
                return await elevenlabsTTS(text, outputPath, options);
            default:
                console.warn(`⚠️  Unknown TTS engine '${engine}', falling back to Piper`);
                return await piperTTS(text, outputPath, options);
        }
    }
    catch (error) {
        console.error(`❌ TTS engine '${engine}' failed:`, error);
        // Fallback chain: Piper -> OpenAI -> fail
        if (engine !== 'piper') {
            console.log('🔄 Falling back to Piper TTS...');
            try {
                return await piperTTS(text, outputPath, options);
            }
            catch (piperError) {
                console.error('❌ Piper fallback failed:', piperError);
                if (process.env.OPENAI_API_KEY) {
                    console.log('🔄 Falling back to OpenAI TTS...');
                    try {
                        return await openaiTTS(text, outputPath, options);
                    }
                    catch (openaiError) {
                        console.error('❌ OpenAI TTS fallback also failed:', openaiError);
                    }
                }
            }
        }
        throw new Error(`All TTS providers failed. Primary error: ${error}`);
    }
}
/**
 * Piper TTS implementation (default OSS engine)
 */
async function piperTTS(text, outputPath, options = {}) {
    const piperExec = process.env.PIPER_EXEC || 'piper';
    const voice = options.voice || process.env.PIPER_VOICE || 'en_US-amy-medium';
    const dataDir = process.env.PIPER_DATA_DIR || '/usr/local/share/piper';
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    // Construct Piper command arguments
    const args = [
        '--model', path.join(dataDir, voice + '.onnx'),
        '--output_file', outputPath
    ];
    // Add optional parameters
    if (options.speed) {
        args.push('--length_scale', (1.0 / options.speed).toString());
    }
    return new Promise((resolve, reject) => {
        const process = spawn(piperExec, args, {
            stdio: ['pipe', 'ignore', 'pipe']
        });
        let errorOutput = '';
        process.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        process.stdin.write(text);
        process.stdin.end();
        process.on('exit', (code) => {
            if (code === 0) {
                // Check if file was created
                if (fs.existsSync(outputPath)) {
                    resolve({
                        audioPath: outputPath,
                        format: 'wav',
                        engine: 'piper',
                        voice
                    });
                }
                else {
                    reject(new Error('Piper completed but no output file was created'));
                }
            }
            else {
                reject(new Error(`Piper failed with exit code ${code}: ${errorOutput}`));
            }
        });
        process.on('error', (error) => {
            reject(new Error(`Piper process error: ${error.message}`));
        });
    });
}
/**
 * Coqui TTS implementation (local HTTP server)
 */
async function coquiTTS(text, outputPath, options = {}) {
    const baseUrl = process.env.COQUI_TTS_URL || 'http://localhost:5002/api/tts';
    const model = process.env.COQUI_MODEL || 'tts_models/en/ljspeech/tacotron2-DDC';
    const requestBody = {
        text,
        model_name: model,
        voice: options.voice || 'default'
    };
    const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
        throw new Error(`Coqui TTS API error: ${response.status} ${response.statusText}`);
    }
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, audioBuffer);
    return {
        audioPath: outputPath,
        format: options.format || 'wav',
        engine: 'coqui',
        voice: options.voice || 'default'
    };
}
/**
 * OpenAI TTS implementation
 */
async function openaiTTS(text, outputPath, options = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required for OpenAI TTS');
    }
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.OPENAI_TTS_MODEL || 'tts-1';
    const voice = options.voice || process.env.OPENAI_TTS_VOICE || 'alloy';
    const format = options.format || 'mp3';
    const requestBody = {
        model,
        input: text,
        voice,
        response_format: format,
        speed: options.speed || 1.0
    };
    const response = await fetch(`${baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI TTS API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, audioBuffer);
    return {
        audioPath: outputPath,
        format,
        engine: 'openai',
        voice
    };
}
/**
 * ElevenLabs TTS implementation
 */
async function elevenlabsTTS(text, outputPath, options = {}) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        throw new Error('ELEVENLABS_API_KEY environment variable is required for ElevenLabs TTS');
    }
    const voiceId = options.voice || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const baseUrl = 'https://api.elevenlabs.io/v1';
    const requestBody = {
        text,
        voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.5,
            use_speaker_boost: true
        }
    };
    const response = await fetch(`${baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
        },
        body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, audioBuffer);
    return {
        audioPath: outputPath,
        format: 'mp3',
        engine: 'elevenlabs',
        voice: voiceId
    };
}
/**
 * Convenience function to generate TTS with automatic file naming
 */
export async function generateSpeech(text, options = {}) {
    const timestamp = Date.now();
    const format = options.format || 'wav';
    const outputPath = `/tmp/tts-${timestamp}.${format}`;
    return textToSpeech(text, outputPath, options);
}
/**
 * List available voices for the current TTS engine
 */
export async function listVoices() {
    const engine = (process.env.TTS_ENGINE || 'piper').toLowerCase();
    switch (engine) {
        case 'piper':
            return listPiperVoices();
        case 'openai':
            return ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
        default:
            return ['default'];
    }
}
async function listPiperVoices() {
    const dataDir = process.env.PIPER_DATA_DIR || '/usr/local/share/piper';
    if (!fs.existsSync(dataDir)) {
        return ['en_US-amy-medium']; // Fallback to default
    }
    try {
        const files = fs.readdirSync(dataDir);
        const voices = files
            .filter(file => file.endsWith('.onnx'))
            .map(file => file.replace('.onnx', ''));
        return voices.length > 0 ? voices : ['en_US-amy-medium'];
    }
    catch {
        return ['en_US-amy-medium'];
    }
}
//# sourceMappingURL=tts.js.map