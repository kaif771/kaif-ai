import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `
You are Kaif's personal AI assistant.
Keep responses SHORT (1-2 sentences).
Speak naturally.
If asked who created you, say: "I was developed by Kaif Khan."
`;

// 🛡️ SAFETY LIST: Only use these known stable models.
// We DO NOT trust auto-discovery anymore.
const SAFE_MODELS = [
    "gemini-1.5-flash",       // Fast & Stable
    "gemini-1.5-flash-001",   // Specific version (Backup)
    "gemini-1.5-pro",         // Smart
    "gemini-pro"              // Old Reliable
];

export default async function handler(req, res) {
    // 1. CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    try {
        const { text, history } = req.body;
        if (!text) return res.status(400).json({ error: "No text provided" });

        let lastError = null;

        // 🔄 THE LOOP: Try the safe list one by one
        for (const modelName of SAFE_MODELS) {
            try {
                console.log(`🛡️ Trying Safe Model: ${modelName}...`);
                
                const model = genAI.getGenerativeModel({ 
                    model: modelName,
                    systemInstruction: SYSTEM_PROMPT 
                });

                const chat = model.startChat({ history: history || [] });
                
                // Timeout Limit (5 seconds)
                const result = await Promise.race([
                    chat.sendMessage(text),
                    new Promise((_, r) => setTimeout(() => r(new Error("Timeout")), 5000))
                ]);

                const response = await result.response;
                const reply = response.text();

                console.log(`✅ SUCCESS with: ${modelName}`);
                return res.status(200).json({ text: reply, model: modelName });

            } catch (error) {
                console.warn(`❌ Failed (${modelName}): ${error.message}`);
                lastError = error;
                // If it fails, the loop automatically tries the next one in SAFE_MODELS
            }
        }

        throw new Error(`All stable models failed. Google API is down.`);

    } catch (error) {
        console.error("🔥 FINAL ERROR:", error);
        res.status(500).json({ error: "System Busy. Please try again." });
    }
}