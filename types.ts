export interface DiagnosisProbability {
  condition: string;
  percentage: number;
}

export interface AIResponseSchema {
  reply: string;
  probabilities: DiagnosisProbability[];
  phase: 'questioning' | 'lab_analysis' | 'final_report';
  progress: number;
}

export interface Attachment {
  mimeType: string;
  data: string; // base64 string for API
  uri?: string; // data uri for UI preview
  name?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  probabilities?: DiagnosisProbability[];
  attachments?: Attachment[];
}

export type Language = string;

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  currentProbabilities: DiagnosisProbability[];
  phase: 'intro' | 'questioning' | 'lab_analysis' | 'final_report';
  language: Language;
}