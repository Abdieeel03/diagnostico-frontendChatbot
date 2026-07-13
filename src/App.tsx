import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sidebar } from "./components/Sidebar";
import { DiagnosticPanel } from "./components/DiagnosticPanel";
import { useChatPersistence } from "./hooks/useChatPersistence";
import { useTypingEffect } from "./hooks/useTypingEffect";
import type { DiagnosticData, Message } from "./types/chat";
import "./App.css";

const typingSpeedMs = 25;

const App = () => {
  // Dark/Light Mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) return savedTheme === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Sync theme class on document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    messagesBySession,
    setMessagesBySession,
    WELCOME_MESSAGE,
  } = useChatPersistence();

  const { triggerTypingEffect, cancelTyping } = useTypingEffect(
    setMessagesBySession,
    { speedMs: typingSpeedMs }
  );

  const activeMessages = useMemo(
    () => messagesBySession[activeSessionId] || [],
    [messagesBySession, activeSessionId]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesBySession, activeSessionId, isGenerating]);

  const handleNewChat = useCallback(() => {
    const newId = `session-${crypto.randomUUID()}`;
    const newSession = {
      id: newId,
      title: "Nueva Consulta Médica",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setMessagesBySession((prev) => ({
      ...prev,
      [newId]: [
        {
          id: `welcome-${newId}`,
          sender: "assistant",
          text: "Bienvenido a Médico AI.\n\nPor favor, describe de forma detallada los síntomas que experimentas (por ejemplo: *'Llevo dos días con fiebre que no baja'* o *'Siento dolor de cabeza y fatiga'*).\n\nAnalizaremos tus síntomas para ofrecerte una lista de posibles diagnósticos de simulación y el nivel de coincidencia.\n\n*Nota: Esta es una herramienta educativa de simulación preliminar. Siempre consulta a un profesional de la salud.*",
          displayedText:
            "Bienvenido a Médico AI.\n\nPor favor, describe de forma detallada los síntomas que experimentas (por ejemplo: *'Llevo dos días con fiebre que no baja'* o *'Siento dolor de cabeza y fatiga'*).\n\nAnalizaremos tus síntomas para ofrecerte una lista de posibles diagnósticos de simulación y el nivel de coincidencia.\n\n*Nota: Esta es una herramienta educativa de simulación preliminar. Siempre consulta a un profesional de la salud.*",
          isFinished: true,
        },
      ],
    }));
  }, [setSessions, setActiveSessionId, setMessagesBySession]);

  const handleSelectSession = useCallback(
    (id: string) => {
      cancelTyping();
      setActiveSessionId(id);
    },
    [cancelTyping, setActiveSessionId]
  );

  const handleDeleteSession = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updatedSessions = sessions.filter((s) => s.id !== id);
      setSessions(() => updatedSessions);

      const updatedMessages = { ...messagesBySession };
      delete updatedMessages[id];
      setMessagesBySession(() => updatedMessages);

      if (activeSessionId === id) {
        if (updatedSessions.length > 0) {
          setActiveSessionId(updatedSessions[0].id);
        } else {
          const newId = "welcome-session";
          setSessions(() => [
            {
              id: newId,
              title: "Consulta Médica Inicial",
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ]);
          setActiveSessionId(newId);
          setMessagesBySession(() => ({
            [newId]: [WELCOME_MESSAGE],
          }));
        }
      }
    },
    [
      sessions,
      messagesBySession,
      activeSessionId,
      setSessions,
      setMessagesBySession,
      setActiveSessionId,
      WELCOME_MESSAGE,
    ]
  );

  const handleSendMessage = useCallback(
    async (textToSend: string) => {
      if (!textToSend.trim() || isGenerating) return;

      const userText = textToSend.trim();
      const isFirstUserMessage = activeMessages.length <= 1;

      if (isFirstUserMessage) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? {
                  ...s,
                  title:
                    userText.length > 25
                      ? `${userText.slice(0, 22)}...`
                      : userText,
                }
              : s
          )
        );
      }

      const userMessageId = `user-${crypto.randomUUID()}`;
      const newUserMessage: Message = {
        id: userMessageId,
        sender: "user",
        text: userText,
        displayedText: userText,
        isFinished: true,
      };

      const assistantMessageId = `assistant-${crypto.randomUUID()}`;
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
          [activeSessionId]: [
            ...currentMsgs,
            newUserMessage,
            newAssistantMessage,
          ],
        };
      });

      setInputValue("");
      setIsGenerating(true);

      const currentSessionId = activeSessionId;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: userText,
            client_id: currentSessionId,
            client_msg_id: userMessageId,
          }),
        });

        if (!response.ok) {
          throw new Error(`Error del servidor: ${response.statusText}`);
        }

        const json = await response.json();
        if (!json.success || !json.data) {
          throw new Error(json.message || "La API reporto un error");
        }

        const finalData: DiagnosticData = json.data;

        setMessagesBySession((prev) => {
          const sessionMsgs = prev[currentSessionId] || [];
          return {
            ...prev,
            [currentSessionId]: sessionMsgs.map((msg) =>
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

        triggerTypingEffect(
          finalData.response,
          assistantMessageId,
          currentSessionId,
          () => {
            setIsGenerating(false);
          }
        );
      } catch (error) {
        console.error("Error al obtener diagnostico:", error);

        const errorMsg =
          "No pudimos conectar con el servicio de diagnóstico. Verifica tu conexión e inténtalo de nuevo.";

        setMessagesBySession((prev) => {
          const sessionMsgs = prev[currentSessionId] || [];
          return {
            ...prev,
            [currentSessionId]: sessionMsgs.map((msg) =>
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
    },
    [
      isGenerating,
      activeMessages,
      activeSessionId,
      setSessions,
      setMessagesBySession,
      triggerTypingEffect,
    ]
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  const suggestions = [
    "Llevo dos días con fiebre que no baja",
    "Siento una fatiga extrema y dolor de cabeza persistente",
    "Dolor abdominal agudo acompañado de náuseas",
  ];

  return (
    <div className="app-layout">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <main className="chat-container">
        <header className="chat-header">
          <div className="header-left">
            <button
              className="mobile-menu-btn"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              title="Abrir historial"
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path
                  fill="currentColor"
                  d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"
                />
              </svg>
            </button>
            <div className="chat-header-title">
              <h2>Médico AI</h2>
            </div>
          </div>

          <div className="header-right">
            <button
              className="theme-toggle-btn"
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {isDarkMode ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        <div className="chat-messages">
          {activeMessages.map((message) => {
            return (
              <div key={message.id} className={`message-row ${message.sender}`}>
                <div className="message-wrapper">
                  <span className="message-sender-name">
                    {message.sender === "user" ? "Usuario" : "Médico AI"}
                  </span>

                  <div className={`message-bubble ${message.isError ? "error-bubble" : ""} ${message.sender === "assistant" && !message.displayedText && !message.isFinished ? "loading-bubble" : ""}`}>
                    {message.sender === "assistant" ? (
                      <div className="assistant-content">
                        {!message.displayedText && !message.isFinished ? (
                          <div className="skeleton-loader">
                            <div className="skeleton-title-bar">Analizando síntomas...</div>
                            <div className="skeleton-line" style={{ width: "85%" }} />
                            <div className="skeleton-line" style={{ width: "65%" }} />
                            <div className="skeleton-line" style={{ width: "75%" }} />
                          </div>
                        ) : (
                          <div className="markdown-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.displayedText || ""}
                            </ReactMarkdown>
                            {!message.isFinished && <span className="llm-cursor" />}
                          </div>
                        )}

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

          <div ref={messagesEndRef} />
        </div>

        {activeMessages.length <= 1 && (
          <div className="suggestions-container">
            <span className="suggestions-title">
              Sugerencias de inicio rápido:
            </span>
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
              <path
                fill="currentColor"
                d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
              />
            </svg>
          </button>
        </form>
      </main>
    </div>
  );
};

export default App;
