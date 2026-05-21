"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, ChevronDown, Bot, Sparkles, ArrowUp, User, Mail, Phone, CheckCircle2, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-config";

const QUICK_REPLIES = [
  "What are the features?",
  "Show me pricing",
  "How does it work?",
  "I want to book a demo"
];

export function FloatingAIWidget() {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"chat" | "name" | "email" | "phone" | "completed">("chat");
  const [userData, setUserData] = useState({ name: "", email: "", phone: "" });
  const [chat, setChat] = useState([
    { sender: "ai", text: "Hi! I'm WhatsFlow AI. How can I help you automate your business today? 🚀" }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat, isOpen]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
        setIsOpen(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const processResponse = async (userText: string) => {
    const newChat = [...chat, { sender: "user", text: userText }];
    setChat(newChat);
    setIsTyping(true);

    let aiResponse = "";
    try {
      if (step === "chat") {
        const normalized = userText.toLowerCase();
        if (normalized.includes("book a demo") || normalized.includes("how does it work") || normalized.includes("pricing")) {
          aiResponse = "Excellent! I'd love to coordinate details to get that answered properly. To begin, may I ask for your name?";
          setStep("name");
        } else {
          // Direct public AI routing
          const data = await apiFetch('/api/chatbot/public', {
            method: 'POST',
            body: JSON.stringify({ message: userText })
          });
          aiResponse = data.reply || "Interesting point! Please let me know if you'd like to 'Book a demo' to dive deeper.";
        }
      } else if (step === "name") {
        setUserData(prev => ({ ...prev, name: userText }));
        aiResponse = `Nice to meet you, ${userText}! And what is your work email address?`;
        setStep("email");
      } else if (step === "email") {
        setUserData(prev => ({ ...prev, email: userText }));
        aiResponse = "Got it. Lastly, please provide your WhatsApp number so an expert can contact you directly.";
        setStep("phone");
      } else if (step === "phone") {
        const finalData = { ...userData, phone: userText };
        setUserData(finalData);
        aiResponse = "Thank you! I've received your details. Our team will contact you on WhatsApp within minutes. 😊";
        setStep("completed");
        console.log("Sending Lead Data to sales:", finalData);
      }
    } catch (err) {
      console.error("Chat error:", err);
      aiResponse = "Pardon me, I got a bit overwhelmed. Please try again or just say 'Book a demo'!";
    } finally {
      setIsTyping(false);
      setChat(prev => [...prev, { sender: "ai", text: aiResponse }]);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    const text = message;
    setMessage("");
    processResponse(text);
  };

  const handleQuickReply = (reply: string) => {
    processResponse(reply);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-center gap-4">
      <AnimatePresence>
        {isVisible && !isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0, y: 10 }}
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToTop}
            className="w-12 h-12 rounded-full bg-white border-2 border-[#22c55e] flex items-center justify-center text-[#22c55e] shadow-[0_8px_16px_-4px_rgba(0,0,0,0.1)] transition-all hover:bg-[#dcfce7]/20 group relative overflow-hidden"
            title="Scroll to Top"
          >
            <ArrowUp className="w-5 h-5 stroke-[2.5] transition-transform group-hover:-translate-y-1" />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center relative gap-4">
        {/* BOTTOM AI ICON BUTTON */}
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.button
              layoutId="widget-toggle"
              key={isOpen ? "open" : "closed"}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isOpen ? { opacity: 1, scale: 1 } : {
                opacity: 1,
                scale: 1,
                y: [0, -8, 0],
              }}
              transition={!isOpen ? {
                y: {
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                },
                duration: 0.5
              } : { duration: 0.5 }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(!isOpen)}
              className={`w-14 h-14 rounded-full border-2 border-[#0F1F0F] shadow-[0_15px_30px_-5px_rgba(22,163,74,0.3)] flex items-center justify-center relative transition-all duration-500 overflow-hidden ${isOpen ? 'bg-[#0f172a]' : 'bg-[#16A34A]'
                }`}
            >
              <AnimatePresence mode="wait">
                {isOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="w-6 h-6 text-white stroke-[2.5]" />
                  </motion.div>
                ) : (
                  <div key="logo" className="w-8 h-8 flex items-center justify-center">
                    <img src="/logo-robot.png" alt="AI" className="w-full h-full object-contain" />
                  </div>
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* CHAT WINDOW */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, transformOrigin: "bottom right" }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="absolute bottom-20 right-0 w-[380px] max-w-[calc(100vw-48px)] bg-white rounded-[32px] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.25)] border border-gray-100 flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-[#22c55e] to-[#15803d] p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center ring-1 ring-white/30 shadow-inner overflow-hidden">
                    <img src="/logo-robot.png" alt="Logo" className="w-8 h-8 object-contain" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-lg leading-tight tracking-tight text-white">WhatsFlow AI</h4>
                    <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-80 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-[#dcfce7] rounded-full animate-pulse" />
                      Online Now
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition-all group active:scale-90"
                >
                  <ChevronDown className="w-5 h-5 transition-transform group-hover:translate-y-0.5" />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            <div 
              ref={scrollRef}
              className="h-[380px] overflow-y-auto p-6 bg-[#f8fafc]/50 flex flex-col gap-4 scrollbar-hide"
            >
              {chat.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === "ai" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed drop-shadow-sm ${msg.sender === "ai"
                      ? "bg-white text-[#0f172a] border border-gray-100 rounded-tl-none font-medium shadow-sm"
                      : "bg-[#22c55e] text-white rounded-tr-none font-bold shadow-lg shadow-green-500/10"
                    }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start animate-in fade-in duration-300">
                  <div className="max-w-[85%] px-4 py-3 bg-white border border-gray-100 rounded-2xl rounded-tl-none flex items-center gap-1.5 shadow-sm">
                    <div className="w-1.5 h-1.5 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              
              {/* Quick Replies Section - Only show when step is 'chat' */}
              {step === "chat" && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {QUICK_REPLIES.map((reply) => (
                    <button
                      key={reply}
                      onClick={() => handleQuickReply(reply)}
                      className="px-4 py-2 bg-[#dcfce7] text-[#15803d] rounded-full text-xs font-bold border border-[#22c55e]/20 hover:bg-[#22c55e] hover:text-white transition-all active:scale-95"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Form Section */}
            <div className="p-4 bg-white border-t border-gray-50">
              {step === "completed" ? (
                <div className="flex items-center justify-center py-2 text-[#16A34A] font-bold gap-2 text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  Details Received!
                </div>
              ) : (
                <form onSubmit={handleSend} className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                      {step === "name" && <User className="w-4 h-4 text-[#22c55e]" />}
                      {step === "email" && <Mail className="w-4 h-4 text-[#22c55e]" />}
                      {step === "phone" && <Phone className="w-4 h-4 text-[#22c55e]" />}
                      {step === "chat" && <Bot className="w-4 h-4 text-[#22c55e]" />}
                    </div>
                    <input
                      type="text"
                      disabled={isTyping}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={
                        isTyping ? "Typing response..." :
                        step === "name" ? "Type your name..." : 
                        step === "email" ? "Enter your email..." :
                        step === "phone" ? "Enter WhatsApp number..." :
                        "Type your message..."
                      }
                      className="w-full bg-gray-50 border-transparent rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20 transition-all font-bold text-[#0f172a] placeholder:text-gray-400 disabled:opacity-60"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isTyping}
                    className="bg-[#22c55e] hover:bg-[#16a34a] text-white w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-md shadow-green-500/20 disabled:opacity-60"
                  >
                    {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



