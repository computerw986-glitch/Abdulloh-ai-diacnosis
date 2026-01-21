import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Activity, 
  Globe, 
  TestTube, 
  FileText, 
  RefreshCw,
  AlertCircle,
  Stethoscope as StethoscopeIcon,
  Paperclip,
  X,
  Image as ImageIcon,
  Key,
  ArrowRight
} from 'lucide-react';
import { sendMessageToGemini } from './services/geminiService';
import { Message, ChatState, Language, DiagnosisProbability, Attachment } from './types';
import ChatMessage from './components/ChatMessage';
import ProbabilityChart from './components/ProbabilityChart';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'uz', name: 'O\'zbek (Uzbek)' },
  { code: 'es', name: 'Español (Spanish)' },
  { code: 'zh', name: '中文 (Chinese)' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'ar', name: 'العربية (Arabic)' },
  { code: 'ru', name: 'Русский (Russian)' },
  { code: 'pt', name: 'Português (Portuguese)' },
  { code: 'fr', name: 'Français (French)' },
  { code: 'de', name: 'Deutsch (German)' },
  { code: 'ja', name: '日本語 (Japanese)' },
  { code: 'tr', name: 'Türkçe (Turkish)' },
  { code: 'ko', name: '한국어 (Korean)' },
  { code: 'vi', name: 'Tiếng Việt (Vietnamese)' },
  { code: 'it', name: 'Italiano (Italian)' },
  { code: 'pl', name: 'Polski (Polish)' },
  { code: 'uk', name: 'Українська (Ukrainian)' },
  { code: 'nl', name: 'Nederlands (Dutch)' },
  { code: 'th', name: 'ไทย (Thai)' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'ur', name: 'اردو (Urdu)' },
  { code: 'sw', name: 'Kiswahili (Swahili)' },
  { code: 'bn', name: 'বাংলা (Bengali)' },
  { code: 'fa', name: 'فارسی (Persian)' },
  { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)' }
];

const INITIAL_PROBABILITIES: DiagnosisProbability[] = [
  { condition: 'Differential Diagnosis', percentage: 0 },
];

const INITIAL_MESSAGE_EN = "Hello. I am Abdulloh AI, an autonomous medical diagnostic assistant. I can analyze symptoms and interpret medical files (ECG, MRI, CT, Labs). Please state your primary complaint or upload your medical reports/images.";
const INITIAL_MESSAGE_UZ = "Salom. Men Abdulloh AI, avtonom tibbiy diagnostika yordamchisiman. Men simptomlarni tahlil qila olaman va tibbiy fayllarni (EKG, MRT, KT, tahlillar) o'qiy olaman. Iltimos, shikoyatingizni ayting yoki tibbiy hisobotlaringizni yuklang.";

function App() {
  const [apiKey, setApiKey] = useState<string>(process.env.API_KEY || '');
  const [tempApiKey, setTempApiKey] = useState('');
  const [apiKeyError, setApiKeyError] = useState<string>('');
  
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    currentProbabilities: INITIAL_PROBABILITIES,
    phase: 'intro',
    language: 'en'
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize chat on mount
  useEffect(() => {
    if (chatState.messages.length === 0) {
      const initialText = chatState.language === 'uz' ? INITIAL_MESSAGE_UZ : INITIAL_MESSAGE_EN;
      setChatState(prev => ({
        ...prev,
        messages: [{
          id: 'init-1',
          role: 'assistant',
          content: initialText,
          timestamp: new Date()
        }]
      }));
    }
  }, [chatState.language]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatState.messages]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setChatState(prev => {
      if (prev.messages.length <= 1 && prev.phase === 'intro') {
         const initialText = newLang === 'uz' ? INITIAL_MESSAGE_UZ : INITIAL_MESSAGE_EN;
         return {
           ...prev,
           language: newLang,
           messages: [{
             id: 'init-1',
             role: 'assistant',
             content: initialText,
             timestamp: new Date()
           }]
         };
      }
      return { ...prev, language: newLang };
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        // Extract the actual base64 data without the data:mime;base64 prefix
        const base64Data = base64String.split(',')[1];
        
        const newAttachment: Attachment = {
          mimeType: file.type,
          data: base64Data,
          uri: base64String, // Keep full URI for preview
          name: file.name
        };

        setAttachments(prev => [...prev, newAttachment]);
      };

      reader.readAsDataURL(file);
      // Reset input value to allow selecting the same file again if needed
      e.target.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveApiKey = () => {
    if (tempApiKey.trim()) {
      setApiKey(tempApiKey.trim());
      setApiKeyError('');
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || !apiKey || chatState.isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      attachments: [...attachments] // Store copy of current attachments
    };

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      isLoading: true
    }));
    
    // Clear inputs immediately
    setInput('');
    setAttachments([]);

    try {
      const response = await sendMessageToGemini(
        chatState.messages, 
        userMsg.content,
        userMsg.attachments || [],
        chatState.language,
        apiKey
      );

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.reply,
        timestamp: new Date(),
        probabilities: response.probabilities
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, aiMsg],
        isLoading: false,
        currentProbabilities: response.probabilities || prev.currentProbabilities,
        phase: response.phase
      }));

    } catch (error: any) {
      console.error(error);
      
      let errorMessage = chatState.language === 'uz' 
          ? "So'rovingizni qayta ishlashda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring."
          : "I encountered an error processing your request. Please try again.";
      
      const errString = JSON.stringify(error);
      const isQuotaError = 
        error.status === 429 || 
        error.code === 429 ||
        error.error?.code === 429 ||
        error.message?.includes('429') || 
        error.message?.includes('quota') || 
        error.message?.includes('RESOURCE_EXHAUSTED') ||
        errString.includes('RESOURCE_EXHAUSTED') ||
        errString.toLowerCase().includes('quota') ||
        errString.includes('"code":429');
      
      if (isQuotaError) {
         const msg = chatState.language === 'uz'
           ? "API kvotasi tugadi (429). Iltimos, yangi kalit kiriting."
           : "API quota exceeded. Please provide a new key.";
         setApiKeyError(msg);
         setApiKey(''); // Force re-entry
         setChatState(prev => ({ ...prev, isLoading: false }));
         return;
      }

      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date()
      };
      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMsg],
        isLoading: false
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setChatState({
      messages: [],
      isLoading: false,
      currentProbabilities: INITIAL_PROBABILITIES,
      phase: 'intro',
      language: chatState.language
    });
    setAttachments([]);
  };

  if (!apiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <div className="text-center mb-6">
            <div className="bg-teal-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-teal-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Abdulloh AI</h1>
            <p className="text-slate-500 text-sm">Autonomous Medical Diagnostic System</p>
          </div>
          
          <div className="mb-6">
            {apiKeyError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{apiKeyError}</p>
              </div>
            ) : (
              <p className="text-slate-600 mb-4 text-center text-sm">
                Please enter your Gemini API Key to access the diagnostic system.
              </p>
            )}
            
            <div className="relative">
              <Key className="absolute left-3 top-3 text-slate-400" size={18} />
              <input 
                 type="password"
                 placeholder="Enter API Key"
                 className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                 value={tempApiKey}
                 onChange={(e) => setTempApiKey(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              Your key is stored locally in your browser session.
            </p>
          </div>

          <button 
            onClick={handleSaveApiKey}
            disabled={!tempApiKey.trim()}
            className={`w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all
              ${tempApiKey.trim() 
                ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-md hover:shadow-lg' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
          >
            Start Diagnostics
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex md:w-80 flex-col bg-white border-r border-slate-200">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="text-teal-600" size={24} />
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Abdulloh AI</h1>
          </div>
          <p className="text-xs text-slate-500">Autonomous Diagnostic System</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Status Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
             <div className="flex items-center justify-between mb-3">
               <span className="text-xs font-semibold text-slate-500 uppercase">Phase</span>
               <span className={`text-xs px-2 py-1 rounded-full font-medium
                 ${chatState.phase === 'questioning' ? 'bg-blue-100 text-blue-700' :
                   chatState.phase === 'lab_analysis' ? 'bg-purple-100 text-purple-700' :
                   chatState.phase === 'final_report' ? 'bg-green-100 text-green-700' :
                   'bg-slate-200 text-slate-700'
                 }`}>
                 {chatState.phase.replace('_', ' ')}
               </span>
             </div>
             <p className="text-sm text-slate-600 leading-snug">
               {chatState.phase === 'intro' && "Initializing comprehensive diagnostic protocol."}
               {chatState.phase === 'questioning' && "Conducting differential diagnosis via structured questioning."}
               {chatState.phase === 'lab_analysis' && "Analyzing laboratory and genetic results."}
               {chatState.phase === 'final_report' && "Ranked diagnosis and treatment strategy generated."}
             </p>
          </div>

          {/* Probabilities */}
          <ProbabilityChart data={chatState.currentProbabilities} />

          {/* Guidelines */}
          <div className="space-y-3">
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Capabilities</h3>
             <div className="flex items-center gap-3 text-sm text-slate-600">
               <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                 <FileText size={16} />
               </div>
               <span>Clinical Interview</span>
             </div>
             <div className="flex items-center gap-3 text-sm text-slate-600">
               <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                 <TestTube size={16} />
               </div>
               <span>Lab & Genetic Analysis</span>
             </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 space-y-2">
          <button 
            onClick={handleReset}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors text-sm font-medium"
          >
            <RefreshCw size={16} />
            New Diagnosis
          </button>
           <button 
            onClick={() => setApiKey('')}
            className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors text-xs font-medium"
          >
            <Key size={14} />
            Change API Key
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Mobile Header */}
        <header className="flex md:hidden items-center justify-between p-4 bg-white border-b border-slate-200 z-10">
          <div className="flex items-center gap-2">
            <Activity className="text-teal-600" size={20} />
            <h1 className="font-bold text-slate-800">Abdulloh AI</h1>
          </div>
          <div className="relative">
             <select
              value={chatState.language}
              onChange={handleLanguageChange}
              className="appearance-none bg-slate-100 border border-slate-200 text-slate-700 py-1.5 pl-3 pr-8 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
             <Globe className="absolute right-2.5 top-2 text-slate-400 pointer-events-none" size={14} />
          </div>
        </header>

        {/* Desktop Header controls */}
        <div className="hidden md:flex absolute top-4 right-6 z-10">
           <div className="relative">
            <select
              value={chatState.language}
              onChange={handleLanguageChange}
              className="appearance-none bg-white/80 backdrop-blur border border-slate-200 text-slate-600 py-1.5 pl-3 pr-8 rounded-full shadow-sm hover:bg-white transition-all text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
            <Globe className="absolute right-2.5 top-2 text-slate-400 pointer-events-none" size={14} />
           </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-2 bg-slate-50">
           {chatState.messages.map((msg) => (
             <ChatMessage key={msg.id} message={msg} />
           ))}
           {chatState.isLoading && (
             <div className="flex justify-start mb-6">
                <div className="flex max-w-[80%] flex-row">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-teal-600 text-white mr-3 flex items-center justify-center mt-1">
                    <StethoscopeIcon size={16} />
                  </div>
                  <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100">
                    <div className="flex space-x-2 h-4 items-center">
                      <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
             </div>
           )}
           <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto relative">
             {/* Attachment Preview */}
             {attachments.length > 0 && (
               <div className="flex flex-wrap gap-2 mb-2 px-2">
                  {attachments.map((att, index) => (
                    <div key={index} className="relative group bg-slate-100 rounded-lg p-1 border border-slate-200">
                      {att.mimeType.startsWith('image/') ? (
                        <img src={att.uri} alt="preview" className="h-16 w-16 object-cover rounded" />
                      ) : (
                        <div className="h-16 w-16 flex flex-col items-center justify-center text-slate-500">
                          <FileText size={20} />
                          <span className="text-[9px] truncate w-full text-center mt-1">{att.name}</span>
                        </div>
                      )}
                      <button 
                        onClick={() => removeAttachment(index)}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
               </div>
             )}

             <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-transparent transition-all shadow-sm">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*,application/pdf"
                  onChange={handleFileSelect}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={chatState.isLoading}
                  className={`p-2.5 rounded-lg mb-0.5 flex-shrink-0 transition-colors
                    ${chatState.isLoading 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                      : 'text-slate-500 hover:bg-slate-200'
                    }`}
                  title="Upload Medical Scan or Report"
                >
                  <Paperclip size={20} />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={chatState.language === 'uz' ? "Semptomlar, laboratoriya natijalari yoki fayllar yuklang..." : "Type symptoms, lab results, or upload files..."}
                  className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-2.5 px-2 text-slate-800 placeholder:text-slate-400"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && attachments.length === 0) || chatState.isLoading}
                  className={`p-2.5 rounded-lg mb-0.5 flex-shrink-0 transition-colors
                    ${(!input.trim() && attachments.length === 0) || chatState.isLoading 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                      : 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm'
                    }`}
                >
                  <Send size={18} />
                </button>
             </div>
             <p className="text-center text-[10px] text-slate-400 mt-2">
               {chatState.language === 'uz' 
                 ? "AI xato qilishi mumkin. Shifokor bilan maslahatlashing."
                 : "AI can make mistakes. Review with a medical professional."}
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for loading state
function Stethoscope({ size }: { size: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

export default App;