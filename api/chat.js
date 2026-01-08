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

        console.log("🔍 dynamic: Fetching model list from Google...");

        // 2. ASK GOOGLE: "What models do I have?"
        const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        if (!listResp.ok) throw new Error(`Failed to list models: ${listResp.statusText}`);
        
        const data = await listResp.json();
        const allModels = data.models || [];

        // 3. FILTER: Only "generateContent" models (Chat models)
        // We also excluding 'vision' specific ones to be safe
        let candidates = allModels
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name.replace("models/", ""));

        // 4. SORT: Put 'flash' first (fastest), then 'pro'
        candidates.sort((a, b) => {
            if (a.includes('flash') && !b.includes('flash')) return -1;
            if (!a.includes('flash') && b.includes('flash')) return 1;
            return 0;
        });

        console.log("📋 Found Candidates:", candidates);

        // 5. TRY THEM ONE BY ONE
        let lastError = null;

        for (const modelName of candidates) {
            
            // Skip the one that was overloaded earlier (optional safety)
            if (modelName.includes("2.5")) {
                console.log(`⚠️ Skipping ${modelName} (known unstable)`);
                continue;
            }

            try {
                console.log(`🔄 Attempting: ${modelName}...`);
                
                const model = genAI.getGenerativeModel({ 
                    model: modelName,
                    systemInstruction: SYSTEM_PROMPT 
                });

                const chat = model.startChat({ history: history || [] });
                
                // Timeout safety (5 seconds)
                const result = await Promise.race([
                    chat.sendMessage(text),
                    new Promise((_, r) => setTimeout(() => r(new Error("Timeout")), 5000))
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

        throw new Error(`All ${candidates.length} available models failed. Last error: ${lastError?.message}`);

    } catch (error) {
        console.error("🔥 FINAL SERVER ERROR:", error);
        res.status(500).json({ error: "System Error: " + error.message });
    }
}