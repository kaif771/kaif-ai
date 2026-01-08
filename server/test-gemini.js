require('dotenv').config();
const WebSocket = require('ws');

const API_KEY = process.env.GEMINI_API_KEY;
const HOST = "generativelanguage.googleapis.com";
const URL = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

console.log("--------------- DIAGNOSTIC TEST ---------------");
console.log(`🔑 Key loaded: ${API_KEY ? "YES" : "NO"}`);
console.log("🌐 Connecting to Gemini 2.0...");

const ws = new WebSocket(URL);

ws.on('open', () => {
    console.log("✅ Connected! (Handshake passed)");
    
    // 1. Send Setup
    const setupMsg = {
        setup: {
            model: "models/gemini-2.0-flash-exp",
            generation_config: { response_modalities: ["AUDIO"] }
        }
    };
    ws.send(JSON.stringify(setupMsg));
    console.log("📤 Setup message sent. Waiting...");

    // 2. Send a simple text event (No Audio) after 1 second
    setTimeout(() => {
        const textMsg = {
            client_content: {
                turns: [{
                    role: "user",
                    parts: [{ text: "Hello, say the word 'Testing' back to me." }]
                }],
                turn_complete: true
            }
        };
        console.log("📤 Sending Text: 'Hello...'");
        ws.send(JSON.stringify(textMsg));
    }, 1000);
});

ws.on('message', (data) => {
    const response = JSON.parse(data.toString());
    console.log("📥 Received Response from Google:");
    console.log(JSON.stringify(response, null, 2)); // Print full detail
});

ws.on('error', (err) => {
    console.error("🔥 ERROR:", err.message);
});

ws.on('close', (code, reason) => {
    console.log(`❌ Disconnected. Code: ${code} | Reason: ${reason}`);
});