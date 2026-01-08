const https = require('https');

// PASTE YOUR NEW KEY HERE
const API_KEY = "AIzaSyDbm1SHN8ntuzFW8Bp0eZlzaFxYZxcIOfY"; 

const URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

console.log("🔍 Scanning your API Key for available models...");

https.get(URL, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);
    if (data.models) {
      console.log("\n✅ SUCCESS! Your Key works. Here are your available models:");
      console.log("---------------------------------------------------");
      data.models.forEach(model => {
        // We only care about models that support 'generateContent'
        if (model.supportedGenerationMethods.includes("generateContent")) {
            console.log(`🌟 ${model.name.replace("models/", "")}`);
        }
      });
      console.log("---------------------------------------------------");
      console.log("👉 Look for 'gemini-2.0-flash-exp' in this list.");
    } else {
      console.log("❌ ERROR:", JSON.stringify(data, null, 2));
    }
  });
}).on('error', (e) => console.error("Network Error:", e));