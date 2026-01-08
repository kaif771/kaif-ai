import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `
You are Kaif's personal AI assistant.
Keep responses SHORT (1-2 sentences).
Speak naturally.
If asked who created you, say: "I was developed by Kaif Khan."
`;

// Helper to find the best available model
async function getBestModel() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        const models = data.models || [];
        
        // Priority: Flash (Fast) -> Pro (Smart) -> Any
        const chatModels = models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
        const best = chatModels.find(m => m.name.includes("flash")) || chatModels[0];
        
        return best ? best.name.replace("models/", "") : "gemini-1.5-flash";
    } catch (e) {
        return "gemini-1.5-flash"; // Fallback if list fails
    }
}

async function tryGenerate(modelName, text, history) {
    console.log(`Attempting with model: ${modelName}`);
    const model = genAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: SYSTEM_PROMPT 
    });
    const chat = model.startChat({ history: history || [] });
    const result = await chat.sendMessage(text);
    return result.response.text();
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    try {
        const { text, history } = req.body;
        if (!text) return res.status(400).json({ error: "No text provided" });

        // 1. Get the Best Model Name
        let activeModel = await getBestModel();
        
        try {
            // 2. Try to generate with that model
            const reply = await tryGenerate(activeModel, text, history);
            res.status(200).json({ text: reply, model: activeModel });

        } catch (error) {
            // ⚠️ ERROR HANDLER (503 Overloaded or 404 Not Found)
            console.warn(`Primary model ${activeModel} failed: ${error.message}`);
            
            // 3. RETRY WITH BACKUP (Stable Model)
            // If the fancy auto-detected model failed, force the standard one
            const backupModel = "gemini-1.5-flash"; 
            
            if (activeModel !== backupModel) {
                console.log(`🔄 Retrying with backup: ${backupModel}`);
                const reply = await tryGenerate(backupModel, text, history);
                res.status(200).json({ text: reply, model: "backup-flash" });
            } else {
                throw error; // If backup also failed, give up
            }
        }

    } catch (error) {
        console.error("AI FATAL ERROR:", error);
        res.status(500).json({ error: "System Busy. Please try again." });
    }
}