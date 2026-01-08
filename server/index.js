require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const upload = multer({ storage: multer.memoryStorage() }); 
app.use(cors());
app.use(express.json());

const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) app.use(express.static(publicPath));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🔍 GLOBAL VARIABLE TO HOLD THE WORKING MODEL
let ACTIVE_MODEL = "";

// 🛠️ SELF-HEALING FUNCTION: Finds a working model automatically
async function findWorkingModel() {
    console.log("🔍 Scanning your API Key for available models...");
    try {
        // 1. Fetch all models your key can see
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();

        if (data.error) {
            console.error("❌ API Key Error:", data.error.message);
            return;
        }

        const models = data.models || [];
        
        // 2. Filter for models that support Chat (generateContent)
        const chatModels = models.filter(m => m.supportedGenerationMethods.includes("generateContent"));

        // 3. SELECTION LOGIC (Prioritize Free/Flash, Avoid Pro-2.5 if quota is 0)
        // We look for 'flash' first because it's usually free and unlimited.
        const flashModel = chatModels.find(m => m.name.includes("flash"));
        const proModel = chatModels.find(m => m.name.includes("pro") && !m.name.includes("vision"));
        
        // Pick the best one
        let bestModel = flashModel || proModel || chatModels[0];

        if (bestModel) {
            // Strip the "models/" prefix if it exists
            ACTIVE_MODEL = bestModel.name.replace("models/", "");
            console.log(`✅ SUCCESS! Selected Model: ${ACTIVE_MODEL}`);
            console.log(`   (Description: ${bestModel.displayName})`);
        } else {
            console.error("❌ No chat models found for this key.");
        }

    } catch (error) {
        console.error("⚠️ Network Error checking models:", error.message);
        // Fallback if network fails
        ACTIVE_MODEL = "gemini-1.5-flash"; 
    }
}

// Run the scan immediately on startup
findWorkingModel();

const SYSTEM_INSTRUCTION = `
You are Kaif's personal AI assistant on a phone call.
1. Keep your responses SHORT and CONVERSATIONAL (1-2 sentences max).
2. Do not use bullet points or long lists. Speak naturally.
3. If asked who created you, say: "I was developed by Kaif Khan."
`;

app.post('/api/chat', async (req, res) => {
    try {
        // Wait 1 second if model hasn't been found yet
        if (!ACTIVE_MODEL) await new Promise(r => setTimeout(r, 1000));

        const textInput = req.body.text;
        const historyRaw = req.body.history || [];

        console.log(`📨 Request received. Using: ${ACTIVE_MODEL}`);

        const model = genAI.getGenerativeModel({ 
            model: ACTIVE_MODEL,
            systemInstruction: SYSTEM_INSTRUCTION 
        });

        const chat = model.startChat({ history: historyRaw });
        
        // Text-only mode (Siri Style)
        if (textInput) {
            console.log(`🗣️ User: "${textInput}"`);
            const result = await chat.sendMessage(textInput);
            const response = await result.response;
            const reply = response.text();
            
            console.log("🤖 AI:", reply);
            res.json({ text: reply });
        } else {
            res.status(400).json({ error: "No text provided" });
        }

    } catch (error) {
        console.error("🔥 Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get(/(.*)/, (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.send("<h1>React App Not Built. Run 'npm run setup'</h1>");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Self-Healing Server running on port ${PORT}`));