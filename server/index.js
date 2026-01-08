import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `
You are Kaif's personal AI assistant.
Keep responses SHORT (1 sentence max).
If asked, say you were developed by Kaif Khan.
`;

export default async function handler(req, res) {
    // 1. CORS Setup
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    try {
        const { text, history } = req.body;
        if (!text) return res.status(200).json({ text: "Please say something." });

        console.log("📝 Received:", text);

        // 2. Try the "Flash" model first (Fastest)
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction: SYSTEM_PROMPT });
            const chat = model.startChat({ history: history || [] });
            const result = await chat.sendMessage(text);
            const response = await result.response;
            
            // Success!
            return res.status(200).json({ text: response.text() });

        } catch (flashError) {
            console.warn("⚠️ Flash failed:", flashError.message);

            // 3. Fallback to "Pro" model (If Flash is missing/404)
            try {
                const model = genAI.getGenerativeModel({ model: "gemini-pro", systemInstruction: SYSTEM_PROMPT });
                const chat = model.startChat({ history: history || [] });
                const result = await chat.sendMessage(text);
                const response = await result.response;
                
                return res.status(200).json({ text: response.text() });

            } catch (proError) {
                // 4. IF EVERYTHING FAILS, DIAGNOSE THE ERROR
                // We return a 200 OK so the App speaks the error description!
                
                console.error("🔥 All models failed:", proError.message);
                
                let errorMsg = "I encountered an unknown system error.";

                if (proError.message.includes("429")) {
                    errorMsg = "My daily energy quota is exceeded. Please create a new API key.";
                } else if (proError.message.includes("404")) {
                    errorMsg = "My AI models are missing. Your API Key might be invalid.";
                } else if (proError.message.includes("API key not valid")) {
                    errorMsg = "My security key is incorrect. Please check Vercel settings.";
                }

                return res.status(200).json({ text: errorMsg });
            }
        }

    } catch (error) {
        return res.status(200).json({ text: "Critical System Failure: " + error.message });
    }
}