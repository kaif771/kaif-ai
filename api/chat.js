import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 📋 THE LIST: We will try these models in order until one works
const MODEL_LIST = [
    "gemini-1.5-flash",      // Option 1: The standard fast one
    "gemini-1.5-flash-001",  // Option 2: The specific version
    "gemini-1.5-pro",        // Option 3: The high-quality one
    "gemini-pro",            // Option 4: The classic stable one
    "gemini-1.0-pro"         // Option 5: The legacy stable one
];

const SYSTEM_PROMPT = `
You are Kaif's personal AI assistant.
Keep responses SHORT (1-2 sentences).
Speak naturally.
If asked who created you, say: "I was developed by Kaif Khan."
`;

export default async function handler(req, res) {
    // 1. CORS Setup
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { text, history } = req.body;
        if (!text) return res.status(400).json({ error: "No text provided" });

        let lastError = null;

        // 🔄 THE RETRY LOOP
        // This tries every model in our list until one succeeds
        for (const modelName of MODEL_LIST) {
            try {
                console.log(`Trying model: ${modelName}...`);
                
                const model = genAI.getGenerativeModel({ 
                    model: modelName, 
                    systemInstruction: SYSTEM_PROMPT 
                });

                const chat = model.startChat({ history: history || [] });
                const result = await chat.sendMessage(text);
                const response = await result.response;
                const reply = response.text();

                // ✅ SUCCESS! We found a working model.
                console.log(`Success with: ${modelName}`);
                return res.status(200).json({ text: reply, modelUsed: modelName });

            } catch (error) {
                console.error(`Failed with ${modelName}: ${error.message}`);
                lastError = error;
                // If 404 (Not Found) or 400 (Not Supported), continue to next model.
                // If it's a different error (like Quota), we might want to stop, but for now we keep trying.
                continue; 
            }
        }

        // If loop finishes and nothing worked:
        throw new Error(`All models failed. Last error: ${lastError?.message}`);

    } catch (error) {
        console.error("FINAL AI ERROR:", error);
        res.status(500).json({ error: "AI Connection Failed: " + error.message });
    }
}