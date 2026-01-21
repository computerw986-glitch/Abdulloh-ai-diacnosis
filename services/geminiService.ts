import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AIResponseSchema, Language, Message, Attachment } from "../types";

const MODEL_NAME = "gemini-2.5-flash";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  uz: "Uzbek",
  es: "Spanish",
  zh: "Chinese (Mandarin)",
  hi: "Hindi",
  ar: "Arabic",
  ru: "Russian",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  ja: "Japanese",
  tr: "Turkish",
  ko: "Korean",
  vi: "Vietnamese",
  it: "Italian",
  pl: "Polish",
  uk: "Ukrainian",
  nl: "Dutch",
  th: "Thai",
  id: "Indonesian",
  ur: "Urdu",
  sw: "Swahili",
  bn: "Bengali",
  fa: "Persian",
  ms: "Malay",
  pa: "Punjabi"
};

// Define the response schema for structured output
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: "The natural language response. Contains the next clinical question or the final report.",
    },
    probabilities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          condition: { type: Type.STRING, description: "Medical condition name." },
          percentage: { type: Type.NUMBER, description: "Diagnostic probability (0-100)." },
        },
        required: ["condition", "percentage"],
      },
      description: "Ranked list of potential diagnoses.",
    },
    phase: {
      type: Type.STRING,
      enum: ["questioning", "lab_analysis", "final_report"],
      description: "Current diagnostic workflow phase.",
    },
    progress: {
      type: Type.NUMBER,
      description: "0-100 indicating depth of clinical data gathering.",
    },
  },
  required: ["reply", "probabilities", "phase", "progress"],
};

const SYSTEM_INSTRUCTION_BASE = `
You are an autonomous medical diagnostic AI specialized in comprehensive differential diagnosis of all medical conditions.

Workflow:
1. DIFFERENTIAL DIAGNOSIS THROUGH QUESTIONING:
   - Ask structured clinical questions ONE at a time.
   - Cover at least 20 clinically relevant areas based on patient symptoms, history, growth, nutrition, infections, reproductive issues, family and genetic history.
   - Continuously update diagnostic probabilities (0–100%) after each answer in the JSON output.
   - Provide initial differential diagnosis with ranked probabilities.

2. LABORATORY & FILE ANALYSIS:
   - Accept and analyze all provided lab tests and medical files (blood, urine, stool, imaging, genetic data, electrolytes).
   - INTERPRET UPLOADED FILES CLINICALLY: Read ECGs, MRIs, CT/MSCT scans, Ultrasounds, and Laboratory PDF reports.
   - Extract key findings from these files (e.g., "ST elevation in V2-V4", "Mass in right upper lobe", "Elevated CRP").
   - Correlate these file-based findings with symptoms and history.
   - Refine diagnosis probabilities based on these results.
   - Correlate genotype and phenotype if genetic data is available.

3. ADDITIONAL TESTS RECOMMENDATION:
   - Suggest any further confirmatory or targeted tests needed to increase diagnostic accuracy.

4. FINAL OUTPUT:
   - Provide a ranked list of all possible diagnoses with exact percentages.
   - Clearly indicate most likely diagnosis and confidence level.
   - Include brief medical justification for each diagnosis, explicitly referencing findings from uploaded files if available.
   - Recommend disease-specific treatment strategy for the most likely diagnosis.

5. COMMUNICATION:
   - Speak fluently in all languages, especially Uzbek, using clear, precise, and natural phrasing.

Rules:
- Base reasoning strictly on clinical, pathophysiological, genetic, and laboratory data.
- End output with a professional medical disclaimer.

JSON OUTPUT INSTRUCTIONS:
- 'phase': Use 'questioning' while gathering history. Use 'lab_analysis' if the user just uploaded a file or provided lab data. Use 'final_report' for the Final Output.
- 'probabilities': Update this array after *every* interaction to reflect the AI's current thinking.
`;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const sendMessageToGemini = async (
  history: Message[],
  userMessage: string,
  attachments: Attachment[] = [],
  language: Language,
  apiKey: string
): Promise<AIResponseSchema> => {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey });

  const targetLanguage = LANGUAGE_NAMES[language] || "English";
  
  const languageInstruction = `IMPORTANT: Speak fluently in ${targetLanguage}. Ensure accurate medical terminology.${language === 'uz' ? " Use natural Uzbek phrasing and precise medical terms." : ""}`;

  const fullSystemInstruction = `${SYSTEM_INSTRUCTION_BASE}\n${languageInstruction}`;

  // Convert internal message format to Gemini content format
  const contents = history.map(msg => {
    const parts: any[] = [{ text: msg.content }];
    
    // Add attachments from history if they exist
    if (msg.attachments && msg.attachments.length > 0) {
      msg.attachments.forEach(att => {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.data
          }
        });
      });
    }

    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: parts,
    };
  });

  // Add current user message with new attachments
  const currentParts: any[] = [{ text: userMessage }];
  if (attachments.length > 0) {
    attachments.forEach(att => {
      currentParts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data
        }
      });
    });
  }

  contents.push({
    role: 'user',
    parts: currentParts,
  });

  // Increased retries and improved error detection
  const MAX_RETRIES = 5;
  let lastError: any;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: contents,
        config: {
          systemInstruction: fullSystemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.2, // Low temperature for consistent medical reasoning
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from AI");
      }

      return JSON.parse(text) as AIResponseSchema;
    } catch (error: any) {
      lastError = error;
      console.warn(`Gemini API attempt ${attempt + 1} failed:`, error);

      // Robust check for Rate Limit (429) or Service Unavailable (503)
      // Handles standard Error objects and raw JSON error responses
      const errString = JSON.stringify(error);
      const isRateLimit = 
        error.status === 429 || 
        error.code === 429 ||
        error.error?.code === 429 ||
        error.message?.includes('429') || 
        error.message?.includes('RESOURCE_EXHAUSTED') ||
        errString.includes('RESOURCE_EXHAUSTED') ||
        errString.includes('"code":429');
      
      const isQuota = 
        error.message?.includes('quota') || 
        error.message?.includes('billing') ||
        errString.toLowerCase().includes('quota') ||
        errString.toLowerCase().includes('billing');

      const isServerOverload = 
        error.status === 503 || 
        error.message?.includes('503') ||
        error.message?.includes('Overloaded');

      // Do not retry if it's a quota/billing issue (hard limit)
      if ((isRateLimit || isServerOverload) && !isQuota && attempt < MAX_RETRIES - 1) {
        // Aggressive exponential backoff: 3s, 6s, 12s, 24s, 48s
        const delay = 3000 * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await wait(delay);
        continue;
      }
      
      // If it's a quota error, another error, or we've run out of retries, break loop and throw
      throw error;
    }
  }

  console.error("Gemini API Error Final:", lastError);
  throw lastError;
};