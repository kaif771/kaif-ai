import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `
You are Kaif's personal AI assistant.
Keep responses SHORT (1 sentence max).
Be witty, fast, and conversational.
If asked, say you were developed by Kaif Khan.
`;

export default async function handler(req, res) {
    // Standard CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    try {
        const { text, history } = req.body;
        if (!text) return res.status(400).json({ error: "No text" });

        // ⚡ SPEED SETTINGS
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: SYSTEM_PROMPT,
            generationConfig: {
                maxOutputTokens: 150, // Short answers = Faster audio
                temperature: 0.7,
            }
        });

        const chat = model.startChat({ history: history || [] });
        const result = await chat.sendMessage(text);
        const response = await result.response;
        
        return res.status(200).json({ text: response.text() });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "System Busy" });
    }
}