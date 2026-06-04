import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sidebar, type ChatSession } from "./components/Sidebar";
import { DiagnosticPanel } from "./components/DiagnosticPanel";
import "./App.css";

// Interface for diagnostic detail from API
interface Diagnostic {
  coincidencias: number;
  enfermedad: string;
  score: number;
}

// Interface representing the API data block
interface DiagnosticData {
  response: string;
  symptoms: string[];
  diagnosticos: Diagnostic[];
}

// Main message representation
interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string; // The full text or the styled output
  displayedText?: string; // Used for the character-by-character typing effect
  diagnosticData?: DiagnosticData; // Collapsible analysis
  isFinished: boolean;
  isError?: boolean;
}

// Map storing messages for each chat session
interface MessagesMap {
  [sessionId: string]: Message[];
}

const App = () => {
  // Configurable typing speed: milliseconds per character. 0 means instant.
  const [typingSpeedMs, setTypingSpeedMs] = useState<number>(15);

  // Connection mode: 'api' (fetches from Scala via proxy) or 'demo' (simulated local responses)
  const [connectionMode, setConnectionMode] = useState<"api" | "demo">("demo");
  const [apiErrorOccurred, setApiErrorOccurred] = useState(false);

  // Mobile sidebar visibility
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Chat sessions state
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: "welcome-session",
      title: "Consulta Médica Inicial",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [activeSessionId, setActiveSessionId] = useState<string>("welcome-session");

  const [messagesBySession, setMessagesBySession] = useState<MessagesMap>({
    "welcome-session": [
      {
        id: "welcome-msg",
        sender: "assistant",
        text: "### ¡Bienvenido al Asistente de Diagnóstico Médico! 🩺\n\nPor favor, describe los síntomas que experimentas de forma detallada (por ejemplo: *'Tengo fiebre y tos desde ayer'* o *'Siento dolor de cabeza y fatiga'*).\n\nAnalizaremos tus síntomas para ofrecerte una lista de posibles diagnósticos de simulación y el nivel de coincidencia.\n\n*Nota: Esta es una herramienta educativa de simulación preliminar. Siempre consulta a un profesional de la salud.*",
        displayedText: "### ¡Bienvenido al Asistente de Diagnóstico Médico! 🩺\n\nPor favor, describe los síntomas que experimentas de forma detallada (por ejemplo: *'Tengo fiebre y tos desde ayer'* o *'Siento dolor de cabeza y fatiga'*).\n\nAnalizaremos tus síntomas para ofrecerte una lista de posibles diagnósticos de simulación y el nivel de coincidencia.\n\n*Nota: Esta es una herramienta educativa de simulación preliminar. Siempre consulta a un profesional de la salud.*",
        isFinished: true,
      },
    ],
  });

  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentIntervalRef = useRef<any>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesBySession, activeSessionId, isGenerating]);

  // Clean up typing effect interval on unmount
  useEffect(() => {
    return () => {
      if (currentIntervalRef.current) clearInterval(currentIntervalRef.current);
    };
  }, []);

  const activeMessages = messagesBySession[activeSessionId] || [];

  // Starts typing effect for assistant response
  const triggerTypingEffect = (
    fullText: string,
    messageId: string,
    speed: number,
    onComplete: () => void
  ) => {
    if (currentIntervalRef.current) {
      clearInterval(currentIntervalRef.current);
    }

    if (speed === 0) {
      // Instant display
      setMessagesBySession((prev) => {
        const sessionMsgs = prev[activeSessionId] || [];
        return {
          ...prev,
          [activeSessionId]: sessionMsgs.map((msg) =>
            msg.id === messageId
              ? { ...msg, displayedText: fullText, isFinished: true }
              : msg
          ),
        };
      });
      onComplete();
      return;
    }

    let index = 0;
    const interval = setInterval(() => {
      index += 2; // Type 2 characters at a time for smoother/faster flow at low speeds
      if (index >= fullText.length) {
        clearInterval(interval);
        setMessagesBySession((prev) => {
          const sessionMsgs = prev[activeSessionId] || [];
          return {
            ...prev,
            [activeSessionId]: sessionMsgs.map((msg) =>
              msg.id === messageId
                ? { ...msg, displayedText: fullText, isFinished: true }
                : msg
            ),
          };
        });
        onComplete();
      } else {
        const chunk = fullText.slice(0, index);
        setMessagesBySession((prev) => {
          const sessionMsgs = prev[activeSessionId] || [];
          return {
            ...prev,
            [activeSessionId]: sessionMsgs.map((msg) =>
              msg.id === messageId ? { ...msg, displayedText: chunk } : msg
            ),
          };
        });
      }
    }, speed);

    currentIntervalRef.current = interval;
  };

  // Create a new session
  const handleNewChat = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: "Nueva Consulta Médica",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setMessagesBySession((prev) => ({
      ...prev,
      [newId]: [
        {
          id: `welcome-${newId}`,
          sender: "assistant",
          text: "### Nueva Consulta Abierta 🩺\n\nDescribe tus síntomas con detalle. Indícame qué sientes y te brindaré una simulación de pre-diagnóstico.",
          displayedText: "### Nueva Consulta Abierta 🩺\n\nDescribe tus síntomas con detalle. Indícame qué sientes y te brindaré una simulación de pre-diagnóstico.",
          isFinished: true,
        },
      ],
    }));
  };

  // Select a session
  const handleSelectSession = (id: string) => {
    // If a typing simulation is running, clear it to avoid printing in the wrong tab
    if (currentIntervalRef.current) {
      clearInterval(currentIntervalRef.current);
    }
    setActiveSessionId(id);
  };

  // Delete a session
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedSessions = sessions.filter((s) => s.id !== id);
    setSessions(updatedSessions);

    const updatedMessages = { ...messagesBySession };
    delete updatedMessages[id];
    setMessagesBySession(updatedMessages);

    if (activeSessionId === id) {
      if (updatedSessions.length > 0) {
        setActiveSessionId(updatedSessions[0].id);
      } else {
        // Create a new session if history becomes empty
        const newId = "welcome-session";
        setSessions([
          {
            id: newId,
            title: "Consulta Médica Inicial",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setActiveSessionId(newId);
        setMessagesBySession({
          [newId]: [
            {
              id: "welcome-msg",
              sender: "assistant",
              text: "### ¡Bienvenido al Asistente de Diagnóstico Médico! 🩺\n\nPor favor, describe los síntomas que experimentas de forma detallada (por ejemplo: *'Tengo fiebre y tos desde ayer'* o *'Siento dolor de cabeza y fatiga'*).\n\nAnalizaremos tus síntomas para ofrecerte una lista de posibles diagnósticos de simulación y el nivel de coincidencia.\n\n*Nota: Esta es una herramienta educativa de simulación preliminar. Siempre consulta a un profesional de la salud.*",
              displayedText: "### ¡Bienvenido al Asistente de Diagnóstico Médico! 🩺\n\nPor favor, describe los síntomas que experimentas de forma detallada (por ejemplo: *'Tengo fiebre y tos desde ayer'* o *'Siento dolor de cabeza y fatiga'*).\n\nAnalizaremos tus síntomas para ofrecerte una lista de posibles diagnósticos de simulación y el nivel de coincidencia.\n\n*Nota: Esta es una herramienta educativa de simulación preliminar. Siempre consulta a un profesional de la salud.*",
              isFinished: true,
            },
          ],
        });
      }
    }
  };

  // Core handler to send query to Scala backend or local Mock engine
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isGenerating) return;

    const userText = textToSend.trim();
    const isFirstUserMessage = activeMessages.length <= 1;

    // Update session title dynamically if this is the first message in a default named session
    if (isFirstUserMessage) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, title: userText.length > 25 ? `${userText.slice(0, 22)}...` : userText }
            : s
        )
      );
    }

    // 1. Add User Message
    const userMessageId = `user-${Date.now()}`;
    const newUserMessage: Message = {
      id: userMessageId,
      sender: "user",
      text: userText,
      displayedText: userText,
      isFinished: true,
    };

    // 2. Add assistant loading placeholder
    const assistantMessageId = `assistant-${Date.now()}`;
    const newAssistantMessage: Message = {
      id: assistantMessageId,
      sender: "assistant",
      text: "",
      displayedText: "",
      isFinished: false,
    };

    setMessagesBySession((prev) => {
      const currentMsgs = prev[activeSessionId] || [];
      return {
        ...prev,
        [activeSessionId]: [...currentMsgs, newUserMessage, newAssistantMessage],
      };
    });

    setInputValue("");
    setIsGenerating(true);
    setApiErrorOccurred(false);

    try {
      let finalData: DiagnosticData;

      if (connectionMode === "api") {
        // Querying the real Scala backend (proxied via Vite configuration)
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: userText }),
        });

        if (!response.ok) {
          throw new Error(`Error del servidor: ${response.statusText}`);
        }

        const json = await response.json();
        if (!json.success || !json.data) {
          throw new Error(json.message || "La API de Scala reportó un error");
        }

        finalData = json.data;
      } else {
        // Local simulation / Demo Mode
        await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate networking lag
        finalData = getDemoResponse(userText);
      }

      // 3. Trigger typing effect with the received response
      setMessagesBySession((prev) => {
        const sessionMsgs = prev[activeSessionId] || [];
        return {
          ...prev,
          [activeSessionId]: sessionMsgs.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  text: finalData.response,
                  diagnosticData: finalData,
                }
              : msg
          ),
        };
      });

      triggerTypingEffect(finalData.response, assistantMessageId, typingSpeedMs, () => {
        setIsGenerating(false);
      });

    } catch (error) {
      console.error("Error al obtener diagnóstico:", error);
      setApiErrorOccurred(true);
      
      const errorMsg = "Lo siento, no logré conectarme con la API de diagnóstico de Scala. Por favor asegúrate de que el servidor esté activo en el puerto 9000 o activa el **Modo Demo** en la parte superior para probar el flujo completo.";
      
      setMessagesBySession((prev) => {
        const sessionMsgs = prev[activeSessionId] || [];
        return {
          ...prev,
          [activeSessionId]: sessionMsgs.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  text: errorMsg,
                  displayedText: errorMsg,
                  isFinished: true,
                  isError: true,
                }
              : msg
          ),
        };
      });
      setIsGenerating(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  // Local rule-based simulated generator matching the exact JSON formats of Scala API
  const getDemoResponse = (input: string): DiagnosticData => {
    const normalized = input.toLowerCase();
    
    // Identify symptoms in query
    const detected: string[] = [];
    if (normalized.includes("fiebre")) detected.push("fiebre");
    if (normalized.includes("tos")) detected.push("tos");
    if (normalized.includes("garganta")) detected.push("garganta");
    if (normalized.includes("cabeza") || normalized.includes("cefalea")) detected.push("cefalea");
    if (normalized.includes("fatiga") || normalized.includes("cansancio")) detected.push("fatiga");
    if (normalized.includes("estomago") || normalized.includes("panza") || normalized.includes("nausea")) detected.push("dolor_estomago");

    // Fallback default symptoms if none identified
    if (detected.length === 0) {
      detected.push("sintomas_generales");
    }

    // Build diagnostics list depending on symptoms
    const diagnosticsList: Diagnostic[] = [];

    if (detected.includes("fiebre") || detected.includes("tos") || detected.includes("garganta")) {
      diagnosticsList.push({ enfermedad: "gripe", score: 0.75, coincidencias: detected.length });
      diagnosticsList.push({ enfermedad: "covid-19", score: 0.65, coincidencias: detected.length });
    }
    
    if (detected.includes("cefalea") || detected.includes("fatiga")) {
      diagnosticsList.push({ enfermedad: "estres_clinico", score: 0.55, coincidencias: detected.length });
      diagnosticsList.push({ enfermedad: "migrana", score: 0.50, coincidencias: 1 });
    }

    if (detected.includes("dolor_estomago")) {
      diagnosticsList.push({ enfermedad: "gastroenteritis", score: 0.70, coincidencias: detected.length });
      diagnosticsList.push({ enfermedad: "indigestión", score: 0.60, coincidencias: 1 });
    }

    // Always put a random minor match to keep list realistic
    diagnosticsList.push({ enfermedad: "resfriado_comun", score: 0.35, coincidencias: 1 });
    diagnosticsList.push({ enfermedad: "alergia_estacional", score: 0.25, coincidencias: 1 });

    // Sort by score desc
    diagnosticsList.sort((a, b) => b.score - a.score);

    const symptomText = detected.map(s => `**${s}**`).join(", ");
    
    const responseText = `Analicé detalladamente tu descripción. He detectado los siguientes síntomas en tu consulta: ${symptomText}.\n\nBasándome en nuestro algoritmo de reglas de diagnóstico clínico, tu sintomatología tiene mayores coincidencias con un cuadro de **${diagnosticsList[0].enfermedad.toUpperCase().replace("_", " ")}** (con un score del ${Math.round(diagnosticsList[0].score * 100)}%).\n\n*   **Recomendación:** Mantén reposo y buena hidratación.\n*   **Nota:** Abajo puedes ver el desglose clínico con las barras de score de todas las posibles enfermedades analizadas para este reporte.`;

    return {
      response: responseText,
      symptoms: detected,
      diagnosticos: diagnosticsList,
    };
  };

  // Realistic medical quick suggestions
  const suggestions = [
    "Tengo fiebre, tos y congestión nasal",
    "Siento fatiga extrema y dolor de cabeza hace dos días",
    "Dolor abdominal fuerte y náuseas",
  ];

  return (
    <div className="app-layout">
      {/* Sidebar for chat sessions */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <main className="chat-container">
        {/* Header bar */}
        <header className="chat-header">
          <div className="header-left">
            <button
              className="mobile-menu-btn"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              title="Abrir historial"
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
              </svg>
            </button>
            <div className="chat-header-title">
              <h2>Asistente Diagnóstico</h2>
            </div>
          </div>

          <div className="header-controls">
            {/* Speed configuration */}
            <div className="speed-selector">
              <label htmlFor="speed-select" className="control-label">Velocidad:</label>
              <select
                id="speed-select"
                value={typingSpeedMs}
                onChange={(e) => setTypingSpeedMs(Number(e.target.value))}
                className="select-control"
              >
                <option value={30}>Lenta</option>
                <option value={15}>Normal</option>
                <option value={5}>Rápida</option>
                <option value={0}>Instante (Sin efecto)</option>
              </select>
            </div>

            {/* Connection mode toggle */}
            <div className="connection-mode-selector">
              <button
                className={`mode-btn ${connectionMode === "api" ? "active" : ""}`}
                onClick={() => setConnectionMode("api")}
                title="Conectar a API Scala local (localhost:9000)"
              >
                Servidor API
              </button>
              <button
                className={`mode-btn ${connectionMode === "demo" ? "active" : ""}`}
                onClick={() => setConnectionMode("demo")}
                title="Usar respuestas simuladas locales"
              >
                Modo Demo
              </button>
            </div>

            <div className="status-indicator">
              <span className={`status-dot ${connectionMode === "demo" ? "demo-mode" : "api-mode"}`} />
              <span>{connectionMode === "demo" ? "Demo" : "Scala API"}</span>
            </div>
          </div>
        </header>

        {/* Chat Messages list */}
        <div className="chat-messages">
          {activeMessages.map((message) => {
            // Ocultar globo vacío del asistente mientras se carga la respuesta
            // (el indicador de carga ya está visible en ese momento)
            if (message.sender === "assistant" && !message.displayedText && !message.isFinished) {
              return null;
            }
            return (
              <div key={message.id} className={`message-row ${message.sender}`}>
                <div className="message-wrapper">
                  <span className="message-sender-name">
                    {message.sender === "user" ? "Paciente" : "Asistente Médico"}
                  </span>
                  
                  <div className={`message-bubble ${message.isError ? "error-bubble" : ""}`}>
                    {message.sender === "assistant" ? (
                      <div className="assistant-content">
                        <div className="markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.displayedText || ""}
                          </ReactMarkdown>
                          {!message.isFinished && <span className="llm-cursor" />}
                        </div>

                        {/* Diagnostic Panel displayed at the bottom once text is finished */}
                        {message.isFinished && message.diagnosticData && (
                          <DiagnosticPanel
                            symptoms={message.diagnosticData.symptoms}
                            diagnosticos={message.diagnosticData.diagnosticos}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="user-content">{message.text}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isGenerating && activeMessages.length > 0 && activeMessages[activeMessages.length - 1].text === "" && (
            <div className="message-row assistant">
              <div className="message-wrapper">
                <span className="message-sender-name">Asistente Médico</span>
                <div className="message-bubble loading-bubble">
                  <div className="typing-indicator">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                  <span className="loading-text">Analizando síntomas con la API...</span>
                </div>
              </div>
            </div>
          )}

          {/* Fallback alert if API failed */}
          {apiErrorOccurred && (
            <div className="fallback-alert">
              <div className="alert-content">
                <span>⚠️ No se detecta la API en puerto 9000. ¿Quieres activar el <strong>Modo Demo</strong> para ver cómo funciona la interfaz?</span>
                <button
                  className="alert-action-btn"
                  onClick={() => {
                    setConnectionMode("demo");
                    setApiErrorOccurred(false);
                    // Remove last error message and retry with demo
                    setMessagesBySession((prev) => {
                      const list = prev[activeSessionId] || [];
                      if (list.length > 0) {
                        return {
                          ...prev,
                          [activeSessionId]: list.slice(0, -2), // Remove user input and assistant error placeholder
                        };
                      }
                      return prev;
                    });
                    setIsGenerating(false);
                  }}
                >
                  Activar Modo Demo
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Prompts */}
        {activeMessages.length <= 1 && (
          <div className="suggestions-container">
            <span className="suggestions-title">Sugerencias de inicio rápido:</span>
            <div className="suggestions-buttons">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="suggestion-btn"
                  onClick={() => handleSendMessage(suggestion)}
                  disabled={isGenerating}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input controls form */}
        <form onSubmit={handleFormSubmit} className="chat-input-form">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Escribe tus síntomas aquí (ej. Fiebre alta y dolor de cabeza)..."
            className="chat-input-field"
            disabled={isGenerating}
          />
          <button
            type="submit"
            className="chat-send-button"
            disabled={!inputValue.trim() || isGenerating}
            title="Enviar mensaje"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </main>
    </div>
  );
};

export default App;