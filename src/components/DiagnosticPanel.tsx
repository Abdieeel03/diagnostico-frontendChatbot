import React, { useState } from "react";

interface Diagnostic {
  coincidencias: number;
  enfermedad: string;
  score: number;
}

interface DiagnosticPanelProps {
  symptoms: string[];
  diagnosticos: Diagnostic[];
}

// Emoji icons per disease for visual flavor
const diseaseIcons: Record<string, string> = {
  gripe: "🤒",
  "covid-19": "🦠",
  covid: "🦠",
  migrana: "🧠",
  estres_clinico: "😰",
  gastroenteritis: "🤢",
  indigestion: "🍽️",
  resfriado_comun: "🤧",
  alergia_estacional: "🌼",
  calculos_renales: "💎",
  otitis_media: "👂",
  varicela: "🔴",
};

const getIcon = (name: string) => diseaseIcons[name] || "🏥";

export const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({
  symptoms = [],
  diagnosticos = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (symptoms.length === 0 && diagnosticos.length === 0) return null;

  const formatName = (n: string) =>
    n.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const getScoreLevel = (score: number) => {
    if (score >= 0.6) return { label: "Alta", cls: "high" };
    if (score >= 0.4) return { label: "Media", cls: "medium" };
    return { label: "Baja", cls: "low" };
  };

  // Top match for the summary bar
  const topMatch = diagnosticos.length > 0 ? diagnosticos[0] : null;
  const topPct = topMatch ? Math.round(topMatch.score * 100) : 0;

  return (
    <div className="dp-container">
      {/* ── Summary Preview (always visible) ── */}
      {topMatch && !isOpen && (
        <div className="dp-summary">
          <div className="dp-summary-left">
            <span className="dp-summary-icon">{getIcon(topMatch.enfermedad)}</span>
            <div className="dp-summary-info">
              <span className="dp-summary-label">Mayor coincidencia</span>
              <span className="dp-summary-disease">{formatName(topMatch.enfermedad)}</span>
            </div>
          </div>
          <div className="dp-summary-right">
            <div className="dp-mini-bar-bg">
              <div
                className={`dp-mini-bar-fill ${getScoreLevel(topMatch.score).cls}`}
                style={{ width: `${topPct}%` }}
              />
            </div>
            <span className={`dp-summary-pct ${getScoreLevel(topMatch.score).cls}`}>{topPct}%</span>
          </div>
        </div>
      )}

      {/* ── Toggle button ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`dp-toggle ${isOpen ? "open" : ""}`}
      >
        <span>{isOpen ? "Ocultar análisis" : "Ver análisis clínico completo"}</span>
        <svg className={`dp-arrow ${isOpen ? "rotate" : ""}`} viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
        </svg>
      </button>

      {/* ── Expanded Panel ── */}
      {isOpen && (
        <div className="dp-expanded">
          {/* Symptoms */}
          {symptoms.length > 0 && (
            <div className="dp-section">
              <div className="dp-section-header">
                <span className="dp-section-icon">🔍</span>
                <span className="dp-section-title">Síntomas Detectados</span>
                <span className="dp-section-count">{symptoms.length}</span>
              </div>
              <div className="dp-tags">
                {symptoms.map((s, i) => (
                  <span key={i} className="dp-tag">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Diagnostics */}
          {diagnosticos.length > 0 && (
            <div className="dp-section">
              <div className="dp-section-header">
                <span className="dp-section-icon">📊</span>
                <span className="dp-section-title">Diagnósticos Posibles</span>
              </div>
              <div className="dp-cards">
                {diagnosticos.map((diag, idx) => {
                  const pct = Math.round(diag.score * 100);
                  const level = getScoreLevel(diag.score);
                  const isTop = idx === 0;
                  return (
                    <div key={idx} className={`dp-card ${isTop ? "top" : ""}`} style={{ animationDelay: `${idx * 60}ms` }}>
                      <div className="dp-card-top">
                        <div className="dp-card-left">
                          <span className="dp-card-icon">{getIcon(diag.enfermedad)}</span>
                          <div className="dp-card-info">
                            <span className="dp-card-name">{formatName(diag.enfermedad)}</span>
                            <span className="dp-card-matches">{diag.coincidencias} síntoma{diag.coincidencias > 1 ? "s" : ""} coincidente{diag.coincidencias > 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <div className={`dp-card-badge ${level.cls}`}>
                          {pct}%
                        </div>
                      </div>
                      <div className="dp-bar-bg">
                        <div className={`dp-bar-fill ${level.cls}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="dp-disclaimer">
            ⚠️ Resultados de simulación educativa. No reemplaza diagnóstico médico profesional.
          </div>
        </div>
      )}
    </div>
  );
};
