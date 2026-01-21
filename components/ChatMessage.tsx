import React from 'react';
import { Message } from '../types';
import { Bot, User, Stethoscope, FileText, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isAi = message.role === 'assistant';

  return (
    <div className={`flex w-full mb-6 ${isAi ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[90%] md:max-w-[75%] ${isAi ? 'flex-row' : 'flex-row-reverse'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mt-1 shadow-sm
          ${isAi ? 'bg-teal-600 text-white mr-3' : 'bg-slate-700 text-white ml-3'}`}>
          {isAi ? <Stethoscope size={16} /> : <User size={16} />}
        </div>

        {/* Bubble */}
        <div className={`flex flex-col`}>
          <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed
            ${isAi 
              ? 'bg-white text-slate-800 rounded-tl-none border border-slate-100' 
              : 'bg-teal-600 text-white rounded-tr-none'
            }`}>
             
             {/* Attachments */}
             {message.attachments && message.attachments.length > 0 && (
               <div className="flex flex-wrap gap-2 mb-3">
                 {message.attachments.map((att, index) => (
                   <div key={index} className="relative group overflow-hidden rounded-lg border border-white/20 bg-black/10">
                      {att.mimeType.startsWith('image/') ? (
                        <img 
                          src={att.uri || `data:${att.mimeType};base64,${att.data}`} 
                          alt="Medical Scan" 
                          className="h-24 w-auto object-cover rounded-lg" 
                        />
                      ) : (
                        <div className="flex items-center gap-2 p-3 bg-slate-100/20 backdrop-blur-sm rounded-lg h-24 w-24 justify-center flex-col">
                          <FileText size={24} className="opacity-80" />
                          <span className="text-[10px] truncate max-w-full px-1">{att.name || 'File'}</span>
                        </div>
                      )}
                   </div>
                 ))}
               </div>
             )}

             {isAi ? (
               <div className="prose prose-sm max-w-none prose-teal">
                 <ReactMarkdown>{message.content}</ReactMarkdown>
               </div>
             ) : (
               <span>{message.content}</span>
             )}
          </div>
          
          {/* Timestamp or Status */}
          <span className={`text-[10px] text-slate-400 mt-1 ${isAi ? 'text-left' : 'text-right'}`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;