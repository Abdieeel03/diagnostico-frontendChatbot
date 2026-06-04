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

export const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({
  symptoms = [],
  diagnosticos = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (symptoms.length === 0 && diagnosticos.length === 0) {
    return null;
  }

  // Format disease name to be more user-friendly (e.g. otitis_media -> Otitis Media)
  const formatDiseaseName = (name: string): string => {
    return name
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Color logic based on score value
  const getScoreColor = (score: number): string => {
    if (score >= 0.6) return "var(--medical-primary)"; // Aquamarine / High match
    if (score >= 0.4) return "var(--medical-warning)"; // Yellow / Medium match
    return "var(--medical-muted)"; // Gray / Low match
  };

  return (
    <div className="diagnostic-panel-container">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`diagnostic-toggle-btn ${isOpen ? "open" : ""}`}
      >
        <span className="toggle-btn-icon">🩺</span>
        <span className="toggle-btn-text">
          {isOpen ? "Ocultar análisis clínico" : "Ver análisis clínico y diagnóstico"}
        </span>
        <svg
          className={`arrow-icon ${isOpen ? "rotate" : ""}`}
          viewBox="0 0 24 24"
          width="18"
          height="18"
        >
          <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
        </svg>
      </button>

      {isOpen && (
        <div className="diagnostic-content-wrapper">
          {symptoms.length > 0 && (
            <div className="symptoms-section">
              <h5 className="section-title">Síntomas Identificados</h5>
              <div className="symptoms-list">
                {symptoms.map((symptom, idx) => (
                  <span key={idx} className="symptom-tag">
                    🔍 {symptom}
                  </span>
                ))}
              </div>
            </div>
          )}

          {diagnosticos.length > 0 && (
            <div className="diagnosticos-section">
              <h5 className="section-title">Posibles Diagnósticos (Simulación)</h5>
              <div className="diagnosticos-list">
                {diagnosticos.map((diag, idx) => {
                  const percentage = Math.round(diag.score * 100);
                  const color = getScoreColor(diag.score);
                  return (
                    <div key={idx} className="diagnostic-card">
                      <div className="diagnostic-card-header">
                        <span className="disease-name">
                          {formatDiseaseName(diag.enfermedad)}
                        </span>
                        <span className="disease-score" style={{ color }}>
                          {percentage}% coincidencia
                        </span>
                      </div>

                      <div className="progress-bar-bg">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>

                      <div className="diagnostic-card-footer">
                        <span>Coincidencias de síntomas: {diag.coincidencias}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
