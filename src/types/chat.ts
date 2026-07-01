export interface Diagnostic {
  coincidencias: number;
  enfermedad: string;
  score: number;
}

export interface DiagnosticData {
  response: string;
  symptoms: string[];
  diagnosticos: Diagnostic[];
}

export interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  displayedText?: string;
  diagnosticData?: DiagnosticData;
  isFinished: boolean;
  isError?: boolean;
}

export interface MessagesMap {
  [sessionId: string]: Message[];
}
