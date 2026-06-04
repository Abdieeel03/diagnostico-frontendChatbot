import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DiagnosticPanel } from "./DiagnosticPanel";
import "./ChatBotMedico.css";

/* ──────────────────────────────────────────────
   CONFIGURABLE TYPING SPEEDS (change here only)
   ────────────────────────────────────────────── */
const TYPING_SPEEDS = {
  slow: 30,     // ms per 2-char chunk
  normal: 15,
  fast: 5,
  instant: 0,
};
const ACTIVE_TYPING_SPEED: keyof typeof TYPING_SPEEDS = "normal";

/* ────────── Types ────────── */
interface Diagnostic {
  coincidencias: number;
  enfermedad: string;
  score: number;
}

interface DiagnosticData {
  response: string;
  symptoms: string[];
  diagnosticos: Diagnostic[];
}

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  displayedText?: string;
  diagnosticData?: DiagnosticData;
  isFinished: boolean;
  isError?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
  messages: Message[];
}

/* ────────── Props ────────── */
interface ChatBotMedicoProps {
  apiUrl?: string;
  defaultMode?: "api" | "demo";
}

/* ────────── Default welcome message ────────── */
const createWelcomeMessage = (): Message => ({
  id: `welcome-${Date.now()}`,
  sender: "assistant",
  text: "### ¡Bienvenido! 🩺\n\nDescribe tus síntomas con detalle y recibirás un análisis de simulación clínica.\n\n*Esta es una herramienta educativa. Consulta siempre a un profesional.*",
  displayedText: "### ¡Bienvenido! 🩺\n\nDescribe tus síntomas con detalle y recibirás un análisis de simulación clínica.\n\n*Esta es una herramienta educativa. Consulta siempre a un profesional.*",
  isFinished: true,
});

/* ──────────────────────────────────────────────
   COMPONENT
   ────────────────────────────────────────────── */
export const ChatBotMedico: React.FC<ChatBotMedicoProps> = ({
  apiUrl = "/api/chat",
  defaultMode = "demo",
}) => {
  /* ── Widget open/close ── */
  const [isOpen, setIsOpen] = useState(false);

  /* ── Menu & history panel ── */
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* ── Sessions ── */
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: "initial-session",
      title: "Consulta Médica",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      messages: [createWelcomeMessage()],
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState("initial-session");

  /* ── Chat state ── */
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [connectionMode] = useState<"api" | "demo">(defaultMode);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef<any>(null);

  /* ── Resize state ── */
  const [widgetSize, setWidgetSize] = useState({ width: 420, height: 600 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const widgetPanelRef = useRef<HTMLDivElement>(null);

  // Current active session helper
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeMessages = activeSession?.messages || [];

  /* ── Auto-scroll ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, isGenerating]);

  /* ── Cleanup ── */
  useEffect(() => {
    return () => {
      if (typingRef.current) clearInterval(typingRef.current);
    };
  }, []);

  /* ── Close menu on outside click ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Resize handlers ── */
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: string) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: widgetSize.width,
        startH: widgetSize.height,
      };

      const onMouseMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const { startX, startY, startW, startH } = resizeRef.current;
        let newW = startW;
        let newH = startH;

        if (direction.includes("left")) {
          newW = Math.max(340, startW + (startX - ev.clientX));
        }
        if (direction.includes("top")) {
          newH = Math.max(400, startH + (startY - ev.clientY));
        }

        // Cap max
        newW = Math.min(newW, window.innerWidth - 40);
        newH = Math.min(newH, window.innerHeight - 40);

        setWidgetSize({ width: newW, height: newH });
      };

      const onMouseUp = () => {
        setIsResizing(false);
        resizeRef.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [widgetSize]
  );

  /* ── Update messages in active session helper ── */
  const updateActiveMessages = (updater: (msgs: Message[]) => Message[]) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId ? { ...s, messages: updater(s.messages) } : s
      )
    );
  };

  /* ── Typing effect ── */
  const triggerTypingEffect = (fullText: string, messageId: string, onComplete: () => void) => {
    if (typingRef.current) clearInterval(typingRef.current);

    const speed = TYPING_SPEEDS[ACTIVE_TYPING_SPEED];

    if (speed === 0) {
      updateActiveMessages((msgs) =>
        msgs.map((m) =>
          m.id === messageId ? { ...m, displayedText: fullText, isFinished: true } : m
        )
      );
      onComplete();
      return;
    }

    let idx = 0;
    const interval = setInterval(() => {
      idx += 2;
      if (idx >= fullText.length) {
        clearInterval(interval);
        updateActiveMessages((msgs) =>
          msgs.map((m) =>
            m.id === messageId ? { ...m, displayedText: fullText, isFinished: true } : m
          )
        );
        onComplete();
      } else {
        const chunk = fullText.slice(0, idx);
        updateActiveMessages((msgs) =>
          msgs.map((m) => (m.id === messageId ? { ...m, displayedText: chunk } : m))
        );
      }
    }, speed);

    typingRef.current = interval;
  };

  /* ── New chat ── */
  const handleNewChat = () => {
    const id = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id,
      title: "Nueva Consulta",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      messages: [createWelcomeMessage()],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(id);
    setIsHistoryOpen(false);
    setIsMenuOpen(false);
  };

  /* ── Select session from history ── */
  const handleSelectSession = (id: string) => {
    if (typingRef.current) clearInterval(typingRef.current);
    setActiveSessionId(id);
    setIsHistoryOpen(false);
  };

  /* ── Delete session ── */
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);

    if (activeSessionId === id) {
      if (updated.length > 0) {
        setActiveSessionId(updated[0].id);
      } else {
        handleNewChat();
      }
    }
  };

  /* ── Send message ── */
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isGenerating) return;
    const userText = textToSend.trim();

    // Update session title on first user message
    const isFirst = activeMessages.length <= 1;
    if (isFirst) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, title: userText.length > 30 ? `${userText.slice(0, 27)}...` : userText }
            : s
        )
      );
    }

    const userMsgId = `user-${Date.now()}`;
    const asstMsgId = `assistant-${Date.now()}`;

    const userMsg: Message = {
      id: userMsgId,
      sender: "user",
      text: userText,
      displayedText: userText,
      isFinished: true,
    };

    const asstPlaceholder: Message = {
      id: asstMsgId,
      sender: "assistant",
      text: "",
      displayedText: "",
      isFinished: false,
    };

    updateActiveMessages((msgs) => [...msgs, userMsg, asstPlaceholder]);
    setInputValue("");
    setIsGenerating(true);

    try {
      let finalData: DiagnosticData;

      if (connectionMode === "api") {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userText }),
        });
        if (!res.ok) throw new Error(`Error del servidor: ${res.statusText}`);
        const json = await res.json();
        if (!json.success || !json.data) throw new Error(json.message || "Error de API");
        finalData = json.data;
      } else {
        await new Promise((r) => setTimeout(r, 800));
        finalData = getDemoResponse(userText);
      }

      updateActiveMessages((msgs) =>
        msgs.map((m) =>
          m.id === asstMsgId ? { ...m, text: finalData.response, diagnosticData: finalData } : m
        )
      );

      triggerTypingEffect(finalData.response, asstMsgId, () => setIsGenerating(false));
    } catch (error) {
      console.error("Error:", error);
      const errorMsg =
        "No se pudo conectar con la API. Verifica que el servidor esté activo o usa el modo Demo.";
      updateActiveMessages((msgs) =>
        msgs.map((m) =>
          m.id === asstMsgId
            ? { ...m, text: errorMsg, displayedText: errorMsg, isFinished: true, isError: true }
            : m
        )
      );
      setIsGenerating(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  /* ── Demo response engine ── */
  const getDemoResponse = (input: string): DiagnosticData => {
    const n = input.toLowerCase();
    const detected: string[] = [];
    if (n.includes("fiebre")) detected.push("fiebre");
    if (n.includes("tos")) detected.push("tos");
    if (n.includes("garganta")) detected.push("garganta");
    if (n.includes("cabeza") || n.includes("cefalea")) detected.push("cefalea");
    if (n.includes("fatiga") || n.includes("cansancio")) detected.push("fatiga");
    if (n.includes("estomago") || n.includes("panza") || n.includes("nausea")) detected.push("dolor_estomago");
    if (detected.length === 0) detected.push("sintomas_generales");

    const diags: Diagnostic[] = [];
    if (detected.includes("fiebre") || detected.includes("tos") || detected.includes("garganta")) {
      diags.push({ enfermedad: "gripe", score: 0.75, coincidencias: detected.length });
      diags.push({ enfermedad: "covid-19", score: 0.65, coincidencias: detected.length });
    }
    if (detected.includes("cefalea") || detected.includes("fatiga")) {
      diags.push({ enfermedad: "estres_clinico", score: 0.55, coincidencias: detected.length });
      diags.push({ enfermedad: "migrana", score: 0.5, coincidencias: 1 });
    }
    if (detected.includes("dolor_estomago")) {
      diags.push({ enfermedad: "gastroenteritis", score: 0.7, coincidencias: detected.length });
      diags.push({ enfermedad: "indigestion", score: 0.6, coincidencias: 1 });
    }
    diags.push({ enfermedad: "resfriado_comun", score: 0.35, coincidencias: 1 });
    diags.push({ enfermedad: "alergia_estacional", score: 0.25, coincidencias: 1 });
    diags.sort((a, b) => b.score - a.score);

    const symptomText = detected.map((s) => `**${s}**`).join(", ");
    const top = diags[0];
    const responseText = `He analizado tu descripción. Síntomas detectados: ${symptomText}.\n\nMayor coincidencia con **${top.enfermedad.toUpperCase().replace(/_/g, " ")}** (${Math.round(top.score * 100)}%).\n\n* **Recomendación:** Reposo e hidratación.\n* Consulta el panel de análisis clínico debajo para ver todos los posibles diagnósticos.`;

    return { response: responseText, symptoms: detected, diagnosticos: diags };
  };

  /* ── Suggestions ── */
  const suggestions = [
    "Fiebre y tos persistente",
    "Dolor de cabeza y fatiga",
    "Dolor abdominal y náuseas",
  ];

  /* ────────────────────────────────────
     RENDER
     ──────────────────────────────────── */
  return (
    <>
      {/* ── Floating Action Button ── */}
      <button
        className="chatbot-fab"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? "Cerrar chatbot" : "Abrir chatbot médico"}
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" width="28" height="28">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="28" height="28">
            <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
            <text x="12" y="13" textAnchor="middle" fontSize="9" fill="currentColor" fontWeight="700">🩺</text>
          </svg>
        )}
      </button>

      {/* ── Chat Widget Panel ── */}
      {isOpen && (
        <div
          ref={widgetPanelRef}
          className={`chatbot-widget ${isResizing ? "resizing" : ""}`}
          style={{ width: widgetSize.width, height: widgetSize.height }}
        >
          {/* Resize handles */}
          <div className="resize-handle resize-top" onMouseDown={(e) => handleResizeStart(e, "top")} />
          <div className="resize-handle resize-left" onMouseDown={(e) => handleResizeStart(e, "left")} />
          <div className="resize-handle resize-top-left" onMouseDown={(e) => handleResizeStart(e, "top-left")} />

          {/* ── Header ── */}
          <header className="widget-header">
            <div className="widget-header-left">
              <span className="widget-logo">🩺</span>
              <div>
                <h3 className="widget-title">Médico AI</h3>
                <span className="widget-status">
                  <span className={`widget-status-dot ${connectionMode === "demo" ? "demo" : "api"}`} />
                  {connectionMode === "demo" ? "Modo Demo" : "Conectado"}
                </span>
              </div>
            </div>

            {/* Three dots menu */}
            <div className="widget-menu-container" ref={menuRef}>
              <button
                className="widget-menu-btn"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                title="Opciones"
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>

              {isMenuOpen && (
                <div className="widget-dropdown">
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setIsHistoryOpen(!isHistoryOpen);
                      setIsMenuOpen(false);
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor" d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
                    </svg>
                    Historial de consultas
                  </button>
                  <button className="dropdown-item" onClick={handleNewChat}>
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                    Nueva consulta
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* ── History Panel (overlay inside widget) ── */}
          {isHistoryOpen && (
            <div className="history-panel">
              <div className="history-panel-header">
                <h4>Historial de Consultas</h4>
                <button className="history-close-btn" onClick={() => setIsHistoryOpen(false)}>
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>
              <div className="history-list">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`history-item ${s.id === activeSessionId ? "active" : ""}`}
                    onClick={() => handleSelectSession(s.id)}
                  >
                    <div className="history-item-content">
                      <svg viewBox="0 0 24 24" width="14" height="14" className="history-chat-icon">
                        <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
                      </svg>
                      <div className="history-item-text">
                        <span className="history-item-title">{s.title}</span>
                        <span className="history-item-time">{s.timestamp}</span>
                      </div>
                    </div>
                    <button
                      className="history-delete-btn"
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      title="Eliminar"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <button className="new-chat-btn-history" onClick={handleNewChat}>
                + Nueva Consulta
              </button>
            </div>
          )}

          {/* ── Messages ── */}
          <div className="widget-messages">
            {activeMessages.map((message) => {
              if (message.sender === "assistant" && !message.displayedText && !message.isFinished) {
                return null;
              }
              return (
                <div key={message.id} className={`widget-msg-row ${message.sender}`}>
                  <span className="widget-msg-sender">
                    {message.sender === "user" ? "Tú" : "Médico AI"}
                  </span>
                  <div className={`widget-msg-bubble ${message.isError ? "error" : ""}`}>
                    {message.sender === "assistant" ? (
                      <div className="widget-assistant-content">
                        <div className="widget-markdown">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.displayedText || ""}
                          </ReactMarkdown>
                          {!message.isFinished && <span className="widget-cursor" />}
                        </div>
                        {message.isFinished && message.diagnosticData && (
                          <DiagnosticPanel
                            symptoms={message.diagnosticData.symptoms}
                            diagnosticos={message.diagnosticData.diagnosticos}
                          />
                        )}
                      </div>
                    ) : (
                      <span>{message.text}</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading indicator */}
            {isGenerating && activeMessages.length > 0 && activeMessages[activeMessages.length - 1].text === "" && (
              <div className="widget-msg-row assistant">
                <span className="widget-msg-sender">Médico AI</span>
                <div className="widget-msg-bubble">
                  <div className="widget-typing">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                  <span className="widget-loading-text">Analizando...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Suggestions ── */}
          {activeMessages.length <= 1 && (
            <div className="widget-suggestions">
              {suggestions.map((s, i) => (
                <button key={i} className="widget-suggestion-btn" onClick={() => handleSendMessage(s)} disabled={isGenerating}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* ── Input ── */}
          <form onSubmit={handleFormSubmit} className="widget-input-form">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Escribe tus síntomas..."
              className="widget-input"
              disabled={isGenerating}
            />
            <button
              type="submit"
              className="widget-send-btn"
              disabled={!inputValue.trim() || isGenerating}
              title="Enviar"
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatBotMedico;
