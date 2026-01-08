import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `
You are Kaif's personal AI assistant.
Keep responses SHORT (1-2 sentences).
Speak naturally.
If asked who created you, say: "I was developed by Kaif Khan."
`;

// 🛡️ THE TANK LIST: Try these in order until one works.
// We mix experimental (fast/new) with stable (older/reliable).
const MODEL_CANDIDATES = [
    "gemini-1.5-flash",         // Standard Fast
    "gemini-2.0-flash-exp",     // New Experimental (Fastest)
    "gemini-1.5-pro",           // Standard Smart
    "gemini-1.5-flash-latest",  // Alternate Alias
    "gemini-1.5-pro-latest",    // Alternate Alias
    "gemini-pro",               // Old Reliable
    "gemini-1.0-pro"            // Legacy
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

        // 🔄 THE LOOP: Try every model in the list
        for (const modelName of MODEL_CANDIDATES) {
            try {
                console.log(`🛡️ Tank Strategy: Attempting ${modelName}...`);
                
                const model = genAI.getGenerativeModel({ 
                    model: modelName,
                    systemInstruction: SYSTEM_PROMPT 
                });

                const chat = model.startChat({ history: history || [] });
                
                // Set a timeout so we don't wait forever on a stuck model
                const result = await Promise.race([
                    chat.sendMessage(text),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
                ]);

                const response = await result.response;
                const reply = response.text();

                // ✅ VICTORY!
                console.log(`✅ Success with: ${modelName}`);
                return res.status(200).json({ text: reply, model: modelName });

            } catch (error) {
                console.warn(`❌ Failed (${modelName}): ${error.message}`);
                lastError = error;
                // CONTINUE to the next model in the list...
            }
        }

        // 💀 IF WE GET HERE, NOTHING WORKED
        console.error("💀 FATAL: All models failed.");
        throw new Error(`All backups failed. Last error: ${lastError?.message}`);

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "System Busy. Please try again." });
    }
}