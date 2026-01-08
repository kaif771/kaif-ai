'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, UserCog, History, X, Volume2, Wifi, Zap } from 'lucide-react'; 

const getApiUrl = () => {
    if (typeof window !== 'undefined') {
        const host = window.location.hostname;
        if (host === 'localhost') return "/api/chat"; 
    }
    return "/api/chat";
}

type ChatMessage = { role: 'user' | 'model'; parts: { text: string }[]; };

export default function KaifAssistant() {
  // STATES
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasConnected, setHasConnected] = useState(false);
  const [statusText, setStatusText] = useState("Tap to Connect");
  const [statusColor, setStatusColor] = useState("text-blue-400");
  const [geminiHistory, setGeminiHistory] = useState<ChatMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // 📝 NEW: Live Subtitles
  const [liveSubtitle, setLiveSubtitle] = useState(""); 
  const [aiSubtitle, setAiSubtitle] = useState("");

  // VOICE
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentVoiceIndex, setCurrentVoiceIndex] = useState(0);
  const [showVoiceName, setShowVoiceName] = useState(false);

  // REFS
  const recognitionRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionActive = useRef(false);
  const isRestarting = useRef(false);

  // 1. VOICE LOADER
  useEffect(() => {
    const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) return;
        const englishVoices = voices.filter(v => v.lang.startsWith('en'));
        setAvailableVoices(englishVoices);

        const savedVoiceName = localStorage.getItem("kaif_preferred_voice");
        if (savedVoiceName) {
            const savedIndex = englishVoices.findIndex(v => v.name === savedVoiceName);
            if (savedIndex >= 0) { setCurrentVoiceIndex(savedIndex); return; }
        }

        const bestVoiceIndex = englishVoices.findIndex(v => 
            v.name.includes("Microsoft Natasha") ||  
            v.name.includes("Natural") ||            
            v.name.includes("Premium")
        );
        setCurrentVoiceIndex(bestVoiceIndex >= 0 ? bestVoiceIndex : 0);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const cycleVoice = () => {
      if (availableVoices.length === 0) return;
      const nextIndex = (currentVoiceIndex + 1) % availableVoices.length;
      setCurrentVoiceIndex(nextIndex);
      localStorage.setItem("kaif_preferred_voice", availableVoices[nextIndex].name);
      setShowVoiceName(true);
      setTimeout(() => setShowVoiceName(false), 2000);
      
      // Quick beep test
      const u = new SpeechSynthesisUtterance("Voice set.");
      u.voice = availableVoices[nextIndex];
      window.speechSynthesis.speak(u);
  };

  // 2. ⚡ REAL-TIME SPEECH RECOGNITION
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
        const recognition = new (window as any).webkitSpeechRecognition();
        
        // 🚀 KEY CHANGE: True makes it "Snappy"
        recognition.continuous = false; 
        recognition.interimResults = true; // Shows text WHILE you speak
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isRestarting.current = false;
            setIsListening(true);
            setStatusText("Listening...");
            setStatusColor("text-cyan-400");
        };

        recognition.onend = () => {
            if (sessionActive.current && !isSpeaking) {
                isRestarting.current = true;
                setTimeout(() => { try { recognition.start(); } catch(e) {} }, 50);
            } else {
                setIsListening(false);
                if (!sessionActive.current) {
                    setStatusText("Tap to Resume");
                    setStatusColor("text-gray-400");
                }
            }
        };

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Update UI immediately (Snappy feel)
            if (interimTranscript) setLiveSubtitle(interimTranscript);
            
            // If we have a final sentence, send it to AI
            if (finalTranscript) {
                setLiveSubtitle(finalTranscript); // Show final correction
                handleUserMessage(finalTranscript);
            }
        };
        recognitionRef.current = recognition;
    } else {
        setStatusText("Browser Not Supported");
    }
  }, [isSpeaking]); 

  const connectAndGreet = async () => {
    sessionActive.current = true;
    setHasConnected(true);
    setStatusText("Connecting...");
    setStatusColor("text-yellow-400");
    try {
        const response = await fetch(getApiUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: "Say 'System Online'.", history: [] }),
        });
        const data = await response.json();
        speakResponse(data.text);
    } catch (error: any) {
        setStatusText("Error");
        setStatusColor("text-red-500");
        sessionActive.current = false;
    }
  };

  const handleUserMessage = async (text: string) => {
      sessionActive.current = true; 
      setStatusText("Thinking...");
      setStatusColor("text-purple-400");
      
      // Clear AI text while thinking
      setAiSubtitle("..."); 

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
          setStatusText("Offline");
          setStatusColor("text-red-500");
          setTimeout(() => startListening(), 1000);
      }
  };

  const speakResponse = (text: string) => {
      setIsSpeaking(true);
      setIsListening(false); 
      setLiveSubtitle(""); // Clear user text
      setAiSubtitle(text); // Show AI text
      
      setStatusText("Speaking...");
      setStatusColor("text-green-400");
      
      if (recognitionRef.current) recognitionRef.current.stop();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1; // Slightly faster for snappy feel
      utterance.pitch = 1.0; 
      if (availableVoices.length > 0) utterance.voice = availableVoices[currentVoiceIndex];

      utterance.onend = () => {
          setIsSpeaking(false);
          if (sessionActive.current) startListening();
      };
      window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
      if (recognitionRef.current && sessionActive.current) {
          try { recognitionRef.current.start(); } catch(e) {}
      }
  };

  const handleMainButton = () => {
      if (!hasConnected) {
          connectAndGreet();
      } else if (sessionActive.current) {
          sessionActive.current = false;
          if (recognitionRef.current) recognitionRef.current.stop();
          window.speechSynthesis.cancel();
          setIsListening(false);
          setIsSpeaking(false);
          setStatusText("Paused");
          setStatusColor("text-gray-400");
          setLiveSubtitle("");
          setAiSubtitle("");
      } else {
          sessionActive.current = true;
          startListening();
      }
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
        const active = isListening || isSpeaking || isRestarting.current;

        for (let i = -1; i <= 1; i++) {
            const jitter = active ? Math.random() * 80 : 5 + Math.random() * 5; 
            const h = active ? 30 + jitter : 10;
            const x = centerX + (i * 30);
            ctx.fillStyle = isSpeaking ? "#4ade80" : (isRestarting.current ? "#22d3ee" : colors[i + 1]);
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
      <style>{` .neon-text { background: linear-gradient(to right, #ffffff, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; } .scrollbar-hide::-webkit-scrollbar { display: none; } `}</style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,#0f172a_0%,#000000_60%)] -z-20" />
      
      {/* SIRI RING */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[80px] -z-20 transition-all duration-300
          ${(isListening || isRestarting.current) ? 'bg-cyan-500/30' : isSpeaking ? 'bg-green-500/30' : 'bg-transparent'}
      `} />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none -z-10"><canvas ref={canvasRef} width="300" height="300" /></div>
      
      {/* HEADER */}
      <header className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${hasConnected ? 'bg-green-400' : 'bg-red-500'}`} />
            <span className="text-[10px] font-bold tracking-[0.2em] text-white/50">{hasConnected ? "ONLINE" : "OFFLINE"}</span>
        </div>
        <div className="text-right"><p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Developed By</p><p className="text-sm font-black tracking-wider text-white neon-text">KAIF KHAN</p></div>
      </header>

      {/* MAIN UI */}
      <div className={`absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center z-10 px-4 transition-opacity duration-500 ${showHistory ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none mb-2">KAIF<br /><span className="neon-text">ASSISTANT</span></h1>
        
        {/* 🎬 NEW: SUBTITLES & STATUS */}
        <div className="min-h-[100px] flex flex-col items-center justify-center mt-6 gap-2">
             
             {/* USER LIVE TEXT */}
             {liveSubtitle && (
                 <div className="px-6 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md animate-in slide-in-from-bottom-2 fade-in">
                    <p className="text-lg font-medium text-cyan-300">"{liveSubtitle}"</p>
                 </div>
             )}

             {/* AI RESPONSE TEXT */}
             {isSpeaking && aiSubtitle && (
                 <div className="px-6 py-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-md max-w-md mx-auto animate-in zoom-in-95 fade-in">
                    <p className="text-xl font-semibold text-white leading-relaxed">{aiSubtitle}</p>
                 </div>
             )}

             {/* STATUS OR VOICE NAME */}
             {!liveSubtitle && !isSpeaking && (
                 <div className="h-8 flex items-center justify-center">
                    {showVoiceName && availableVoices[currentVoiceIndex] ? (
                        <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-mono text-cyan-300">Voice: {availableVoices[currentVoiceIndex].name}</span>
                    ) : (
                        <p className={`text-xl font-medium tracking-wide ${statusColor} drop-shadow-lg`}>{statusText}</p>
                    )}
                 </div>
             )}
        </div>
      </div>

      {/* CONTROLS */}
      <div className="absolute bottom-10 w-full flex justify-center z-40">
        <div className="bg-[#0f172a]/80 backdrop-blur-xl rounded-[35px] px-8 py-4 flex items-center gap-8 shadow-2xl border border-white/5">
          <button onClick={cycleVoice} className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center active:bg-white/20 transition-colors hover:scale-105"><UserCog className="w-6 h-6 text-blue-200" /></button>
          
          <button onClick={handleMainButton} className={`w-20 h-20 rounded-full flex items-center justify-center -mt-8 border-[6px] border-[#020205] transition-all 
            ${!hasConnected ? 'bg-white animate-bounce' : ''} 
            ${hasConnected && !sessionActive.current ? 'bg-white hover:scale-105' : ''} 
            ${sessionActive.current && !isSpeaking ? 'bg-cyan-500 shadow-cyan-500/50 scale-110' : ''} 
            ${isSpeaking ? 'bg-green-500 shadow-green-500/50 scale-110' : ''}
            `}>
            {!hasConnected ? <Wifi className="w-8 h-8 text-black" /> : 
             isSpeaking ? <Volume2 className="w-8 h-8 text-white" /> : 
             (sessionActive.current ? <Mic className="w-8 h-8 text-white" /> : <MicOff className="w-8 h-8 text-black" />)}
          </button>
          
          <button onClick={() => setShowHistory(!showHistory)} className={`w-14 h-14 rounded-full bg-white/5 flex items-center justify-center active:bg-white/20 transition-colors ${showHistory ? 'bg-white/20' : ''}`}><History className="w-6 h-6 text-pink-200" /></button>
        </div>
      </div>
      
      {/* HISTORY OVERLAY (unchanged) */}
      <div className={`absolute inset-0 z-30 bg-[#020205]/95 backdrop-blur-xl transition-transform duration-500 ${showHistory ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex flex-col h-full p-6 pt-20 max-w-2xl mx-auto">
              <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-white">History</h2><button onClick={() => setGeminiHistory([])} className="text-xs text-red-400 hover:text-red-300 uppercase tracking-widest">Clear All</button></div>
              <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 pb-20">{geminiHistory.map((msg, i) => (<div key={i} className="mb-4"><span className={`text-xs font-bold ${msg.role === 'model' ? 'text-blue-400' : 'text-gray-500'}`}>{msg.role === 'model' ? 'KAIF AI' : 'YOU'}</span><div className={`mt-1 p-3 rounded-xl text-sm ${msg.role === 'model' ? 'bg-white/10 text-white' : 'bg-gray-800 text-gray-300'}`}>{msg.parts[0].text}</div></div>))}</div>
              <button onClick={() => setShowHistory(false)} className="absolute top-6 right-6 p-2 bg-white/10 rounded-full"><X className="w-6 h-6 text-white" /></button>
          </div>
      </div>
    </div>
  );
}