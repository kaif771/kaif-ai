const https = require('https');

// 1. PUT YOUR NEW KEY HERE (Hardcoded)
const API_KEY = "AIzaSyDbm1SHN8ntuzFW8Bp0eZlzaFxYZxcIOfY"; 

const MODEL = "gemini-1.5-flash"; // We test 1.5 first because it's most stable
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

const data = JSON.stringify({
  contents: [{ parts: [{ text: "Explain how AI works in one sentence." }] }]
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

console.log(`🔎 Testing Key ending in: ...${API_KEY.slice(-4)}`);
console.log("⏳ Sending request to Google...");

const req = https.request(URL, options, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    const response = JSON.parse(body);
    
    if (res.statusCode === 200) {
      console.log("\n✅ SUCCESS! The Key is VALID.");
      console.log("🤖 Gemini says:", response.candidates[0].content.parts[0].text);
    } else {
      console.log("\n❌ FAILED. Google rejected the key.");
      console.log("ERROR CODE:", res.statusCode);
      console.log("REASON:", JSON.stringify(response, null, 2));
    }
  });
});

req.on('error', (e) => console.error("🔥 Network Error:", e));
req.write(data);
req.end();