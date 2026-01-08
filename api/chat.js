// api/chat.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    // 1. CORS Setup (Allows your frontend to talk to this backend)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle Preflight (Browser checking if server is safe)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { text, history } = req.body;

        if (!text) return res.status(400).json({ error: "No text provided" });

        // 2. AI Logic (Same as before, but faster)
        // We use "gemini-1.5-flash" because it's fast and usually free
        // If it fails, Vercel logs will tell us.
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: `
                You are Kaif's personal AI assistant.
                Keep responses SHORT (1-2 sentences).
                Speak naturally.
                If asked who created you, say: "I was developed by Kaif Khan."
            `
        });

        const chat = model.startChat({ history: history || [] });
        const result = await chat.sendMessage(text);
        const response = await result.response;
        const reply = response.text();

        res.status(200).json({ text: reply });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "AI Error: " + error.message });
    }
}