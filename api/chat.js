import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `
You are Kaif's personal AI assistant.
Keep responses SHORT (1-2 sentences).
Speak naturally.
If asked who created you, say: "I was developed by Kaif Khan."
`;

// Helper to find a working model dynamically
async function getWorkingModel() {
    try {
        // 1. Ask Google for the list of models available to this Key
        // This fixes the "404 Not Found" guessing game
        const modelResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await modelResponse.json();
        
        const models = data.models || [];
        
        // 2. Filter for models that support "generateContent" (Chat)
        const chatModels = models.filter(m => m.supportedGenerationMethods.includes("generateContent"));

        // 3. Priority: Try to find a 'Flash' or 'Pro' model first
        const flash = chatModels.find(m => m.name.includes("flash"));
        const pro = chatModels.find(m => m.name.includes("pro"));
        const any = chatModels[0];

        // Return the best match name (removing "models/" prefix if present)
        const selected = flash || pro || any;
        
        if (!selected) throw new Error("No chat models found for this API Key.");
        
        return selected.name.replace("models/", "");

    } catch (error) {
        console.error("Auto-Discovery Failed:", error);
        // Fallback to the most basic legacy model if discovery fails
        return "gemini-pro";
    }
}

export default async function handler(req, res) {
    // CORS Setup
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

        // 🔍 AUTO-DISCOVER MODEL
        const activeModelName = await getWorkingModel();
        console.log(`Using Auto-Discovered Model: ${activeModelName}`);

        const model = genAI.getGenerativeModel({ 
            model: activeModelName,
            systemInstruction: SYSTEM_PROMPT 
        });

        const chat = model.startChat({ history: history || [] });
        const result = await chat.sendMessage(text);
        const response = await result.response;
        const reply = response.text();

        res.status(200).json({ text: reply, model: activeModelName });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "Error: " + error.message });
    }
}