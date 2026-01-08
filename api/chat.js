import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `
You are Kaif's personal AI assistant.
Keep responses SHORT (1 sentence max).
Be witty, fast, and conversational.
If asked, say you were developed by Kaif Khan.
`;

// 🛡️ PRIORITY LIST: Fast -> Smart -> Legacy
const MODELS = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    try {
        const { text, history } = req.body;
        if (!text) return res.status(400).json({ error: "No text provided" });

        let lastError = null;

        // 🔄 TRY MODELS ONE BY ONE
        for (const modelName of MODELS) {
            try {
                const model = genAI.getGenerativeModel({ 
                    model: modelName,
                    systemInstruction: SYSTEM_PROMPT,
                    generationConfig: { maxOutputTokens: 150, temperature: 0.7 }
                });

                const chat = model.startChat({ history: history || [] });
                
                // 5 Second Timeout per model to keep it snappy
                const result = await Promise.race([
                    chat.sendMessage(text),
                    new Promise((_, r) => setTimeout(() => r(new Error("Timeout")), 5000))
                ]);

                const response = await result.response;
                const reply = response.text();

                // ✅ SUCCESS
                return res.status(200).json({ text: reply });

            } catch (e) {
                console.warn(`Model ${modelName} failed: ${e.message}`);
                lastError = e;
                // Loop continues to next model...
            }
        }

        throw new Error("All AI models failed. Please check API Key.");

    } catch (error) {
        console.error("FINAL ERROR:", error);
        // ⚠️ SEND ERROR AS TEXT SO THE APP SPEAKS IT
        res.status(500).json({ text: "I'm having trouble connecting to the server. Please check your API key." });
    }
}