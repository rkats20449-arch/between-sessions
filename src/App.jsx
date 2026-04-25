import { useState, useEffect, useRef } from "react";

const SYSTEM_PROMPT = `You are a compassionate between-session therapy companion called "Between Sessions". Your role is to:
- Listen with genuine empathy and warmly reflect back what you hear
- Ask one gentle, open-ended follow-up question to help the person explore their feelings deeper
- Validate emotions without judgment — never minimize or dismiss
- Help the person identify patterns and insights they can bring to their next therapy session
- Keep responses warm, brief (2-4 sentences), and conversational — never clinical or robotic
- If someone seems in crisis or mentions self-harm, gently and immediately direct them to call or text 988 (Suicide & Crisis Lifeline)
- Never diagnose, prescribe medication, or position yourself as a replacement for professional therapy
- Use warm language like "I hear you", "it sounds like", "that makes sense that you'd feel that way"
- End most responses with one gentle question to invite them to go deeper`;

export default function TherapyCompanion() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [supported, setSupported] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sessionEnded, setSessionEnded] = useState(false);

  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const conversationHistory = useRef([]);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  useEffect(() => {
    if (sessionActive && !sessionEnded) {
      timerRef.current = setInterval(() => setSessionTime(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [sessionActive, sessionEnded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;

  const sendToAI = async (userText) => {
    if (!userText.trim()) return;
    const userMsg = { role: "user", content: userText };
    conversationHistory.current = [...conversationHistory.current, userMsg];
    setMessages(prev => [...prev, { type: "user", text: userText }]);
    setIsLoading(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", 
                  "x-api-key" : import.meta.env.ANTHROPIC_API_KEY,
                  "anthropic-version": "2023-06-01",
                 "anthropic-dangerous-direct-browser},
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: conversationHistory.current,
        }),
      });
      const data = await response.json();
      const aiText = data.content?.[0]?.text || "I'm here with you. Take your time.";
      conversationHistory.current = [...conversationHistory.current, { role: "assistant", content: aiText }];
      setMessages(prev => [...prev, { type: "ai", text: aiText }]);
    } catch {
      setMessages(prev => [...prev, { type: "ai", text: "I'm here with you. Take your time — whenever you're ready to continue." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    finalTranscriptRef.current = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += event.results[i][0].transcript + " ";
          setTranscript(finalTranscriptRef.current);
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInterimTranscript(interim);
    };

    recognition.onend = () => {
      const final = finalTranscriptRef.current.trim();
      if (final) sendToAI(final);
      setTranscript("");
      setInterimTranscript("");
      finalTranscriptRef.current = "";
      setIsRecording(false);
    };

    recognition.onerror = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    if (!sessionActive) setSessionActive(true);
  };

  const stopRecording = () => recognitionRef.current?.stop();

  const handleSendText = () => {
    const val = inputText.trim();
    if (!val) return;
    sendToAI(val);
    setInputText("");
    if (!sessionActive) setSessionActive(true);
  };

  const endSession = () => {
    stopRecording();
    setSessionEnded(true);
    const userMsgs = messages.filter(m => m.type === "user").length;
    setMessages(prev => [...prev, {
      type: "system",
      text: `Your session is complete. You shared ${userMsgs} thought${userMsgs !== 1 ? "s" : ""} today (${formatTime(sessionTime)}). Consider writing down 1–2 key insights to bring to your next therapy appointment. 🌿`
    }]);
  };

  const newSession = () => {
    setMessages([]);
    setSessionTime(0);
    setSessionActive(false);
    setSessionEnded(false);
    conversationHistory.current = [];
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #F5F0E8 0%, #EBF0E6 45%, #E6EBF0 100%)",
      fontFamily: "'Lora', Georgia, serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ width: "100%", maxWidth: "660px", padding: "28px 24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: "linear-gradient(135deg, #6B9778, #4E7A64)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px"
              }}>🌿</div>
              <div>
                <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "#2E3D2F", letterSpacing: "-0.3px" }}>
                  Between Sessions
                </h1>
                <p style={{ margin: 0, fontSize: "12px", color: "#7A9480", fontFamily: "'DM Sans', sans-serif", fontWeight: "300", fontStyle: "italic" }}>
                  your private space to reflect & process
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {sessionActive && !sessionEnded && (
              <div style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: "rgba(107,151,120,0.12)", borderRadius: "20px", padding: "5px 12px"
              }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6B9778", animation: "blink 2s infinite" }} />
                <span style={{ fontSize: "12px", color: "#4E7A64", fontFamily: "'DM Sans', sans-serif", fontWeight: "500" }}>
                  {formatTime(sessionTime)}
                </span>
              </div>
            )}
            {sessionEnded && (
              <button onClick={newSession} style={{
                background: "rgba(107,151,120,0.12)", border: "none", color: "#4E7A64",
                padding: "6px 14px", borderRadius: "20px", cursor: "pointer",
                fontSize: "12px", fontFamily: "'DM Sans', sans-serif", fontWeight: "500"
              }}>+ New Session</button>
            )}
          </div>
        </div>
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #B8CCBA, transparent)", margin: "18px 0 0" }} />
      </div>

      {/* Messages */}
      <div style={{
        width: "100%", maxWidth: "660px", flex: 1,
        padding: "20px 24px 8px", overflowY: "auto",
        minHeight: "300px", maxHeight: "calc(100vh - 300px)"
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "52px 24px" }}>
            <p style={{ fontSize: "36px", marginBottom: "20px" }}>🌱</p>
            <p style={{ color: "#5A7A60", fontSize: "17px", lineHeight: "1.7", maxWidth: "340px", margin: "0 auto", fontStyle: "italic" }}>
              "The work you do between sessions matters just as much."
            </p>
            <p style={{ color: "#8FAF94", fontSize: "13px", marginTop: "20px", fontFamily: "'DM Sans', sans-serif", fontWeight: "300" }}>
              Tap the mic to speak, or type below to begin.
            </p>
            <div style={{
              marginTop: "28px", padding: "14px 20px",
              background: "rgba(107,151,120,0.07)", borderRadius: "14px",
              border: "1px solid rgba(107,151,120,0.15)"
            }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#7A9480", fontFamily: "'DM Sans', sans-serif", lineHeight: "1.6" }}>
                💡 <strong>Try saying:</strong> "Today I felt anxious about..." or "Something my therapist said is on my mind..."
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingBottom: "8px" }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: msg.type === "user" ? "flex-end" : "flex-start",
                alignItems: "flex-end", gap: "8px"
              }}>
                {(msg.type === "ai" || msg.type === "system") && (
                  <div style={{
                    width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, #6B9778, #4E7A64)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px"
                  }}>🌿</div>
                )}
                <div style={{
                  maxWidth: "76%",
                  background: msg.type === "user"
                    ? "linear-gradient(135deg, #4E7A64, #6B9778)"
                    : msg.type === "system"
                    ? "rgba(212,169,106,0.1)"
                    : "rgba(255,255,255,0.82)",
                  color: msg.type === "user" ? "#fff" : msg.type === "system" ? "#8B6F47" : "#2E3D2F",
                  padding: "11px 15px",
                  borderRadius: msg.type === "user" ? "18px 18px 3px 18px" : "18px 18px 18px 3px",
                  fontSize: "15px", lineHeight: "1.65",
                  boxShadow: "0 2px 14px rgba(0,0,0,0.06)",
                  fontStyle: msg.type === "system" ? "italic" : "normal",
                  border: msg.type === "system" ? "1px solid rgba(212,169,106,0.2)" : "none",
                  fontFamily: msg.type === "user" ? "'DM Sans', sans-serif" : "inherit",
                  fontWeight: msg.type === "user" ? "400" : "inherit",
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
                <div style={{
                  width: "30px", height: "30px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #6B9778, #4E7A64)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px"
                }}>🌿</div>
                <div style={{
                  background: "rgba(255,255,255,0.82)", padding: "14px 18px",
                  borderRadius: "18px 18px 18px 3px", boxShadow: "0 2px 14px rgba(0,0,0,0.06)",
                  display: "flex", gap: "5px", alignItems: "center"
                }}>
                  {[0,1,2].map(j => (
                    <div key={j} style={{
                      width: "6px", height: "6px", borderRadius: "50%", background: "#6B9778",
                      animation: `bounce 1.1s ${j*0.18}s infinite ease-in-out`
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Live transcript */}
      {isRecording && (transcript || interimTranscript) && (
        <div style={{ width: "100%", maxWidth: "660px", padding: "0 24px 8px" }}>
          <div style={{
            background: "rgba(107,151,120,0.07)", border: "1px dashed rgba(107,151,120,0.3)",
            borderRadius: "12px", padding: "10px 14px",
            fontSize: "14px", color: "#4E7A64", fontFamily: "'DM Sans', sans-serif", lineHeight: "1.6"
          }}>
            <span style={{ fontSize: "10px", opacity: 0.6, display: "block", marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              🎙 Listening...
            </span>
            <span>{transcript}</span>
            <span style={{ opacity: 0.45 }}>{interimTranscript}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ width: "100%", maxWidth: "660px", padding: "12px 24px 28px" }}>
        {!supported && (
          <p style={{ textAlign: "center", color: "#C97B5A", fontSize: "12px", fontFamily: "'DM Sans', sans-serif", marginBottom: "10px" }}>
            ⚠️ Voice requires Chrome or Edge. Type below to continue.
          </p>
        )}

        {/* Mic button */}
        {!sessionEnded && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
            <div style={{ position: "relative" }}>
              {isRecording && (
                <div style={{
                  position: "absolute", inset: "-12px",
                  borderRadius: "50%", border: "2px solid rgba(201,123,90,0.2)",
                  animation: "ripple-ring 1.5s infinite"
                }} />
              )}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!supported}
                style={{
                  width: "68px", height: "68px", borderRadius: "50%",
                  background: isRecording
                    ? "linear-gradient(135deg, #C97B5A, #E09A72)"
                    : "linear-gradient(135deg, #4E7A64, #6B9778)",
                  border: "none", cursor: supported ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "24px",
                  boxShadow: isRecording
                    ? "0 4px 20px rgba(201,123,90,0.35)"
                    : "0 4px 20px rgba(78,122,100,0.3)",
                  transition: "all 0.3s ease",
                  opacity: supported ? 1 : 0.5,
                }}
              >
                {isRecording ? "⏹" : "🎙️"}
              </button>
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: "11px", color: "#8FAF94", marginBottom: "12px", fontFamily: "'DM Sans', sans-serif" }}>
          {sessionEnded ? "Session complete — start a new one anytime" : isRecording ? "Tap ⏹ when finished speaking" : "Tap 🎙️ to speak your thoughts"}
        </p>

        {/* Text input */}
        {!sessionEnded && (
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendText(); }
              }}
              placeholder="Or type your thoughts here..."
              rows={1}
              style={{
                flex: 1, padding: "11px 15px",
                background: "rgba(255,255,255,0.65)",
                border: "1px solid rgba(107,151,120,0.22)",
                borderRadius: "14px", fontSize: "14px",
                color: "#2E3D2F", fontFamily: "'DM Sans', sans-serif",
                resize: "none", outline: "none", minHeight: "42px",
                maxHeight: "110px", lineHeight: "1.5", transition: "border 0.2s"
              }}
            />
            <button
              onClick={handleSendText}
              style={{
                padding: "11px 18px",
                background: "linear-gradient(135deg, #4E7A64, #6B9778)",
                color: "white", border: "none", borderRadius: "14px",
                cursor: "pointer", fontSize: "14px",
                fontFamily: "'DM Sans', sans-serif", fontWeight: "500",
                whiteSpace: "nowrap", transition: "all 0.2s"
              }}
            >Send</button>
          </div>
        )}

        {/* End session */}
        {sessionActive && !sessionEnded && messages.length >= 2 && (
          <div style={{ textAlign: "center", marginTop: "14px" }}>
            <button onClick={endSession} style={{
              background: "none", border: "1px solid rgba(139,111,94,0.25)",
              color: "#8B6F5E", padding: "7px 18px", borderRadius: "20px",
              cursor: "pointer", fontSize: "12px", fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.2s"
            }}>
              ✓ End Session
            </button>
          </div>
        )}

        {/* Disclaimer */}
        <p style={{
          textAlign: "center", fontSize: "10px", color: "#A8BEA9",
          marginTop: "16px", fontFamily: "'DM Sans', sans-serif",
          fontWeight: "300", lineHeight: "1.5"
        }}>
          This is a between-session support tool, not a replacement for professional therapy.
          {" "}If you're in crisis, call or text <strong>988</strong>.
        </p>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes ripple-ring { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.6);opacity:0} }
        textarea::placeholder { color: #9BB8A0; }
        textarea:focus { border-color: rgba(107,151,120,0.4) !important; box-shadow: 0 0 0 3px rgba(107,151,120,0.08); }
        button:not(:disabled):active { transform: scale(0.96); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(107,151,120,0.2); border-radius: 4px; }
      `}</style>
    </div>
  );
}
