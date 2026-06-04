import React from "react";

export interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
}

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions = [],
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  isOpenMobile,
  onCloseMobile,
}) => {
  return (
    <aside className={`chat-sidebar ${isOpenMobile ? "mobile-open" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-icon">🩺</span>
          <span className="logo-text">Médico AI</span>
        </div>
        <button className="new-chat-btn" onClick={() => { onNewChat(); onCloseMobile(); }}>
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Nueva Consulta
        </button>
      </div>

      <div className="sidebar-body">
        <div className="sidebar-section-title">Historial de Consultas</div>
        {sessions.length === 0 ? (
          <div className="empty-history">
            <p>No hay consultas previas</p>
          </div>
        ) : (
          <div className="sessions-list">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => {
                  onSelectSession(session.id);
                  onCloseMobile();
                }}
                className={`session-item ${session.id === activeSessionId ? "active" : ""}`}
              >
                <div className="session-item-content">
                  <svg
                    className="chat-bubble-icon"
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                  >
                    <path
                      fill="currentColor"
                      d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"
                    />
                  </svg>
                  <span className="session-title" title={session.title}>
                    {session.title}
                  </span>
                </div>
                <button
                  className="delete-session-btn"
                  onClick={(e) => onDeleteSession(session.id, e)}
                  title="Eliminar consulta"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path
                      fill="currentColor"
                      d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="disclaimer-mini">
          <p>⚠️ Uso estrictamente informativo. No reemplaza consulta médica.</p>
        </div>
      </div>
    </aside>
  );
};
