'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, UserCog, History, X, Volume2, Wifi } from 'lucide-react'; 

const getApiUrl = () => {
    const host = window.location.hostname;
    if (host === 'localhost' && window.location.port !== '8080') {
        return `http://localhost:8080/api/chat`;
    }
    return `/api/chat`;
}

type ChatMessage = { role: 'user' | 'model'; parts: { text: string }[]; };

export default function KaifAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasConnected, setHasConnected] = useState(false);
  const [statusText, setStatusText] = useState("Tap to Connect");
  const [statusColor, setStatusColor] = useState("text-blue-400");
  const [geminiHistory, setGeminiHistory] = useState<ChatMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // 🗣️ VOICE SETTINGS
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentVoiceIndex, setCurrentVoiceIndex] = useState(0);
  const [showVoiceName, setShowVoiceName] = useState(false);

  // REFS
  const recognitionRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);

  // 1. SMART VOICE LOADER (Avoids Robotic Voices)
  useEffect(() => {
    const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) return;

        const englishVoices = voices.filter(v => v.lang.startsWith('en'));
        setAvailableVoices(englishVoices);

        // A. Check for Saved Voice
        const savedVoiceName = localStorage.getItem("kaif_preferred_voice");
        if (savedVoiceName) {
            const savedIndex = englishVoices.findIndex(v => v.name === savedVoiceName);
            if (savedIndex >= 0) {
                setCurrentVoiceIndex(savedIndex);
                return; 
            }
        }

        // B. Hunt for "Good" Voices (Natasha -> Natural -> Premium -> UK)
        const bestVoiceIndex = englishVoices.findIndex(v => 
            v.name.includes("Microsoft Natasha") ||  
            v.name.includes("Natural") ||            
            v.name.includes("Premium") ||            
            v.name.includes("Google UK English Male")
        );

        if (bestVoiceIndex >= 0) {
            setCurrentVoiceIndex(bestVoiceIndex);
        } else {
            // C. Fallback (Avoid US Robot if possible)
            const standardIndex = englishVoices.findIndex(v => v.name.includes("Google"));
            setCurrentVoiceIndex(standardIndex >= 0 ? standardIndex : 0);
        }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // 2. CYCLE VOICE & SAVE
  const cycleVoice = () => {
      if (availableVoices.length === 0) return;
      const nextIndex = (currentVoiceIndex + 1) % availableVoices.length;
      setCurrentVoiceIndex(nextIndex);
      
      localStorage.setItem("kaif_preferred_voice", availableVoices[nextIndex].name);
      
      setShowVoiceName(true);
      setTimeout(() => setShowVoiceName(false), 2000);
      
      const testUtterance = new SpeechSynthesisUtterance("Voice updated.");
      testUtterance.voice = availableVoices[nextIndex];
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(testUtterance);
  };

  // 3. SPEECH RECOGNITION SETUP
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
        const recognition = new (window as any).webkitSpeechRecognition();
        recognition.continuous = false; 
        recognition.lang = 'en-US';
        recognition.interimResults = false;

        recognition.onstart = () => {
            setIsListening(true);
            setStatusText("I'm Listening...");
            setStatusColor("text-cyan-400");
            clearTimeout(silenceTimer.current!);
            silenceTimer.current = setTimeout(() => { recognition.stop(); }, 5000);
        };

        recognition.onend = () => {
            setIsListening(false);
            if (!isSpeaking && hasConnected) {
                setStatusText("Tap to Speak");
                setStatusColor("text-gray-400");
            }
        };

        recognition.onresult = (event: any) => {
            clearTimeout(silenceTimer.current!);
            const transcript = event.results[0][0].transcript;
            handleUserMessage(transcript);
        };

        recognitionRef.current = recognition;
    } else {
        setStatusText("Browser Not Supported");
    }
  }, [hasConnected, isSpeaking]);

  const connectAndGreet = async () => {
    setStatusText("Connecting...");
    setStatusColor("text-yellow-400");
    try {
        const response = await fetch(getApiUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: "Say 'System Online'.", history: [] }),
        });
        const data = await response.json();
        setHasConnected(true);
        speakResponse(data.text);
    } catch (error) {
        console.error(error);
        setStatusText("Connection Failed");
        setStatusColor("text-red-500");
    }
  };

  const handleUserMessage = async (text: string) => {
      setStatusText("Thinking...");
      setStatusColor("text-yellow-400");

      try {
          const response = await fetch(getApiUrl(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: text, history: geminiHistory }),
          });

          const data = await response.json();
          setGeminiHistory(prev => [...prev, { role: "user", parts: [{ text: text }] }, { role: "model", parts: [{ text: data.text }] }]);
          speakResponse(data.text);
      } catch (error) {
          console.error(error);
          setStatusText("Server Error");
          setStatusColor("text-red-500");
      }
  };

  const speakResponse = (text: string) => {
      setIsSpeaking(true);
      setStatusText("Speaking...");
      setStatusColor("text-green-400");

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0; 
      utterance.pitch = 1.0; 
      
      if (availableVoices.length > 0) {
          utterance.voice = availableVoices[currentVoiceIndex];
      }

      utterance.onend = () => {
          setIsSpeaking(false);
          // AUTO-LISTEN LOOP
          setTimeout(() => startListening(), 500);
      };

      window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
      if (recognitionRef.current && !isListening && !isSpeaking) {
          try { recognitionRef.current.start(); } catch(e) {}
      }
  };

  const handleMainButton = () => {
      if (!hasConnected) connectAndGreet();
      else if (isListening || isSpeaking) {
          if (recognitionRef.current) recognitionRef.current.stop();
          window.speechSynthesis.cancel();
          setIsListening(false);
          setIsSpeaking(false);
          setStatusText("Tap to Resume");
          setStatusColor("text-gray-400");
      } else startListening();
  };

  // VISUALIZER
  useEffect(() => {
    let animationId: number;
    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const colors = ["#22d3ee", "#e879f9", "#22d3ee"]; 
        for (let i = -1; i <= 1; i++) {
            const isActive = isListening || isSpeaking;
            const h = isActive ? 30 + Math.random() * 80 : 10;
            const x = centerX + (i * 30);
            ctx.fillStyle = colors[i + 1];
            ctx.beginPath();
            // @ts-ignore
            if(ctx.roundRect) ctx.roundRect(x - 10, centerY - h/2, 20, h, 10);
            else ctx.rect(x - 10, centerY - h/2, 20, h);
            ctx.fill();
        }
        animationId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isListening, isSpeaking]);

  return (
    <div className="relative w-full min-h-[100dvh] overflow-hidden bg-[#020205] text-white font-sans select-none touch-none">
      <style>{`
        .neon-text { background: linear-gradient(to right, #ffffff, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
      
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,#0f172a_0%,#000000_60%)] -z-20" />
      
      {/* Siri Ring */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[80px] -z-20 transition-all duration-500
          ${isListening ? 'bg-cyan-500/30' : isSpeaking ? 'bg-green-500/30' : 'bg-transparent'}
      `} />

      {/* Visualizer */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none -z-10">
         <canvas ref={canvasRef} width="300" height="300" />
      </div>

      {/* HEADER */}
      <header className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${hasConnected ? 'bg-green-400' : 'bg-red-500'}`} />
            <span className="text-[10px] font-bold tracking-[0.2em] text-white/50">{hasConnected ? "SYSTEM ONLINE" : "OFFLINE"}</span>
        </div>
        <div className="text-right">
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Developed By</p>
            <p className="text-sm font-black tracking-wider text-white neon-text">KAIF KHAN</p>
        </div>
      </header>

      {/* MAIN TITLE */}
      <div className={`absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center z-10 px-4 transition-opacity duration-500 ${showHistory ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none mb-2">KAIF<br /><span className="neon-text">ASSISTANT</span></h1>
        
        {/* VOICE NAME INDICATOR */}
        <div className="h-8 flex items-center justify-center mt-4">
             {showVoiceName && availableVoices[currentVoiceIndex] ? (
                 <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-mono text-cyan-300 animate-in fade-in slide-in-from-bottom-1">
                     Saved Voice: {availableVoices[currentVoiceIndex].name}
                 </span>
             ) : (
                 <p className={`text-xl font-medium tracking-wide ${statusColor} drop-shadow-lg`}>{statusText}</p>
             )}
        </div>
      </div>

      {/* HISTORY PANEL */}
      <div className={`absolute inset-0 z-30 bg-[#020205]/95 backdrop-blur-xl transition-transform duration-500 ${showHistory ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex flex-col h-full p-6 pt-20 max-w-2xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white">History</h2>
                  <button onClick={() => setGeminiHistory([])} className="text-xs text-red-400 hover:text-red-300 uppercase tracking-widest">Clear All</button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 pb-20">
                  {geminiHistory.map((msg, i) => (
                      <div key={i} className="mb-4">
                          <span className={`text-xs font-bold ${msg.role === 'model' ? 'text-blue-400' : 'text-gray-500'}`}>
                              {msg.role === 'model' ? 'KAIF AI' : 'YOU'}
                          </span>
                          <div className={`mt-1 p-3 rounded-xl text-sm ${msg.role === 'model' ? 'bg-white/10 text-white' : 'bg-gray-800 text-gray-300'}`}>
                              {msg.parts[0].text}
                          </div>
                      </div>
                  ))}
              </div>
              <button onClick={() => setShowHistory(false)} className="absolute top-6 right-6 p-2 bg-white/10 rounded-full">
                  <X className="w-6 h-6 text-white" />
              </button>
          </div>
      </div>

      {/* CONTROLS */}
      <div className="absolute bottom-10 w-full flex justify-center z-40">
        <div className="bg-[#0f172a]/80 backdrop-blur-xl rounded-[35px] px-8 py-4 flex items-center gap-8 shadow-2xl">
          
          {/* 🗣️ VOICE CHANGER BUTTON */}
          <button onClick={cycleVoice} className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center active:bg-white/20 transition-colors hover:scale-105">
            <UserCog className="w-6 h-6 text-blue-200" />
          </button>
          
          <button onClick={handleMainButton} className={`w-20 h-20 rounded-full flex items-center justify-center -mt-8 border-[6px] border-[#020205] transition-all 
            ${!hasConnected ? 'bg-white animate-bounce' : ''}
            ${hasConnected && !isListening && !isSpeaking ? 'bg-white hover:scale-105' : ''}
            ${isListening ? 'bg-cyan-500 shadow-cyan-500/50 scale-110' : ''}
            ${isSpeaking ? 'bg-green-500 shadow-green-500/50 scale-110' : ''}
            `}>
            
            {!hasConnected ? <Wifi className="w-8 h-8 text-black" /> : 
             isListening ? <Mic className="w-8 h-8 text-white" /> : 
             isSpeaking ? <Volume2 className="w-8 h-8 text-white" /> :
             <MicOff className="w-8 h-8 text-black" />}
          </button>
          
          <button onClick={() => setShowHistory(!showHistory)} className={`w-14 h-14 rounded-full bg-white/5 flex items-center justify-center active:bg-white/20 transition-colors ${showHistory ? 'bg-white/20' : ''}`}><History className="w-6 h-6 text-pink-200" /></button>
        </div>
      </div>
    </div>
  );
}