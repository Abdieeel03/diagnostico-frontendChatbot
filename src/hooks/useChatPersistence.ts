import { useState, useCallback } from "react";
import type { ChatSession } from "../components/Sidebar";
import type { MessagesMap, Message } from "../types/chat";

const STORAGE_KEY_SESSIONS = "diagnostico_sessions";
const STORAGE_KEY_ACTIVE = "diagnostico_active_session";
const STORAGE_KEY_MESSAGES = "diagnostico_messages";

const WELCOME_MESSAGE: Message = {
  id: "welcome-msg",
  sender: "assistant",
  text: "### ¡Bienvenido al Asistente de Diagnóstico Médico! 🩺\n\nPor favor, describe los síntomas que experimentas de forma detallada (por ejemplo: *'Tengo fiebre y tos desde ayer'* o *'Siento dolor de cabeza y fatiga'*).\n\nAnalizaremos tus síntomas para ofrecerte una lista de posibles diagnósticos de simulación y el nivel de coincidencia.\n\n*Nota: Esta es una herramienta educativa de simulación preliminar. Siempre consulta a un profesional de la salud.*",
  displayedText:
    "### ¡Bienvenido al Asistente de Diagnóstico Médico! 🩺\n\nPor favor, describe los síntomas que experimentas de forma detallada (por ejemplo: *'Tengo fiebre y tos desde ayer'* o *'Siento dolor de cabeza y fatiga'*).\n\nAnalizaremos tus síntomas para ofrecerte una lista de posibles diagnósticos de simulación y el nivel de coincidencia.\n\n*Nota: Esta es una herramienta educativa de simulación preliminar. Siempre consulta a un profesional de la salud.*",
  isFinished: true,
};

const DEFAULT_SESSION: ChatSession = {
  id: "welcome-session",
  title: "Consulta Médica Inicial",
  timestamp: new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  }),
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* corrupted data, use fallback */
  }
  return fallback;
}

function saveToStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}

export const useChatPersistence = () => {
  const [sessions, setSessionsState] = useState<ChatSession[]>(() => {
    const saved = loadFromStorage<ChatSession[]>(STORAGE_KEY_SESSIONS, []);
    return saved.length > 0 ? saved : [DEFAULT_SESSION];
  });

  const [activeSessionId, setActiveSessionIdState] = useState<string>(() => {
    const saved = loadFromStorage<string>(STORAGE_KEY_ACTIVE, "");
    return saved || "welcome-session";
  });

  const [messagesBySession, setMessagesBySessionState] = useState<MessagesMap>(() => {
    const saved = loadFromStorage<MessagesMap>(STORAGE_KEY_MESSAGES, {});
    const active = loadFromStorage<string>(STORAGE_KEY_ACTIVE, "");
    if (active && saved[active]) {
      return saved;
    }
    return {
      "welcome-session": [WELCOME_MESSAGE],
    };
  });

  const updateSessions = useCallback(
    (updater: (prev: ChatSession[]) => ChatSession[]) => {
      setSessionsState((prev) => {
        const next = updater(prev);
        saveToStorage(STORAGE_KEY_SESSIONS, next);
        return next;
      });
    },
    []
  );

  const updateActiveSessionId = useCallback(
    (id: string) => {
      setActiveSessionIdState(id);
      saveToStorage(STORAGE_KEY_ACTIVE, id);
    },
    []
  );

  const updateMessages = useCallback(
    (updater: (prev: MessagesMap) => MessagesMap) => {
      setMessagesBySessionState((prev) => {
        const next = updater(prev);
        saveToStorage(STORAGE_KEY_MESSAGES, next);
        return next;
      });
    },
    []
  );

  return {
    sessions,
    setSessions: updateSessions,
    activeSessionId,
    setActiveSessionId: updateActiveSessionId,
    messagesBySession,
    setMessagesBySession: updateMessages,
    WELCOME_MESSAGE,
    DEFAULT_SESSION,
  };
};
