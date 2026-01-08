import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `
You are Kaif's personal AI assistant.
Keep responses SHORT (1-2 sentences).
Speak naturally.
If asked who created you, say: "I was developed by Kaif Khan."
`;

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

        console.log("🚀 VERSION: DYNAMIC TANK 2.0 - STARTING");

        // 2. DOWNLOAD REAL MODEL LIST FROM GOOGLE
        const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        if (!listResp.ok) throw new Error(`Google API List Failed: ${listResp.statusText}`);
        
        const data = await listResp.json();
        const allModels = data.models || [];

        // 3. FILTER & SORT
        // We exclude 2.5 because we KNOW it is crashing for you (503)
        let candidates = allModels
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name.replace("models/", ""))
            .filter(name => !name.includes("2.5")); // 🚫 BLOCKING THE BROKEN MODEL

        // Sort: Flash first, then Pro
        candidates.sort((a, b) => {
            if (a.includes('flash') && !b.includes('flash')) return -1;
            if (!a.includes('flash') && b.includes('flash')) return 1;
            return 0;
        });

        console.log(`📋 Candidates found: ${JSON.stringify(candidates)}`);

        if (candidates.length === 0) {
            // Emergency fallback if list is empty
            candidates = ["gemini-pro", "gemini-1.5-pro"]; 
        }

        // 4. TRY THEM ALL (The Tank Loop)
        let lastError = null;

        for (const modelName of candidates) {
            try {
                console.log(`🔄 Attempting: ${modelName}...`);
                
                const model = genAI.getGenerativeModel({ 
                    model: modelName,
                    systemInstruction: SYSTEM_PROMPT 
                });

                const chat = model.startChat({ history: history || [] });
                
                // 8 Second Timeout
                const result = await Promise.race([
                    chat.sendMessage(text),
                    new Promise((_, r) => setTimeout(() => r(new Error("Timeout")), 8000))
                ]);

                const response = await result.response;
                const reply = response.text();

                console.log(`✅ SUCCESS with ${modelName}!`);
                return res.status(200).json({ text: reply, model: modelName });

            } catch (err) {
                console.warn(`❌ Failed ${modelName}: ${err.message}`);
                lastError = err;
            }
        }

        throw new Error(`All models failed. Last error: ${lastError?.message}`);

    } catch (error) {
        console.error("🔥 FINAL SERVER ERROR:", error);
        res.status(500).json({ error: "System Busy" });
    }
}