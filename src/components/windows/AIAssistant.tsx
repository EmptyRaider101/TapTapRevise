import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Sparkles, Settings } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../ui/select';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function AIAssistant() {
  const { files, activeFileId, notes, aiModel, setAIModel, geminiApiKey, openWindow } = useStore();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Hi! I can help you understand your documents or answer questions about your notes. Try mentioning "@file-notes" or "@exam-notes"!' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      // Collect context
      let context = '';
      const activeFile = files.find(f => f.id === activeFileId);
      
      if (activeFile) {
        context += `\n--- ACTIVE FILE CONTENT (${activeFile.name}) ---\n${activeFile.content || 'No content extracted.'}\n`;
      }
      
      if (userMsg.includes('@file-notes') && activeFile) {
        const fileNotes = notes.find(n => n.fileId === activeFile.id);
        context += `\n--- NOTES FOR ${activeFile.name} ---\n${fileNotes?.content || 'No notes yet.'}\n`;
      }
      
      if (userMsg.includes('@exam-notes') || userMsg.includes('@global-notes')) {
        const globalNotes = notes.find(n => n.fileId === 'global');
        context += `\n--- GLOBAL NOTES ---\n${globalNotes?.content || 'No global notes yet.'}\n`;
      }

      let responseText = '';
      if (geminiApiKey) {
        try {
          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const model = genAI.getGenerativeModel({ model: aiModel });
          
          const prompt = `${context}\n\nUser Question: ${userMsg}\n\nPlease answer based on the provided context if possible. Use markdown for formatting.`;
          
          const result = await model.generateContent(prompt);
          const response = await result.response;
          responseText = response.text();
        } catch (apiError: any) {
          console.error('Gemini API Error:', apiError);
          responseText = `Error calling Gemini API: ${apiError.message || 'Unknown error'}. Please check your API key in settings.`;
        }
      } else {
        // Simulation if no key
        await new Promise(r => setTimeout(r, 1500));
        responseText = `I analyzed your request using **${aiModel}** based on the current context.\n\n${
          activeFile ? `I see you're looking at **${activeFile.name}**.` : 'You have no file selected.'
        } ${
          userMsg.includes('@file-notes') ? 'I also read your file notes.' : ''
        } ${
          userMsg.includes('@exam-notes') ? 'I checked your exam prep notes as requested.' : ''
        }\n\n**Note:** This is a simulated response. To enable real AI, please click the gear icon in the top right and enter your Google Gemini API key.`;
      }

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: responseText }]);
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Sorry, I encountered an error.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-400 via-transparent to-transparent pointer-events-none"></div>
      
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <Bot className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assistant</span>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={aiModel} onValueChange={(v: any) => setAIModel(v)}>
            <SelectTrigger className="w-[150px] h-7 text-[10px] bg-muted/30">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini-3.1-flash-lite-preview" className="text-xs">gemini-3.1-flash-lite-preview</SelectItem>
              <SelectItem value="gemma-4-31b-it" className="text-xs">gemma-4-31b-it</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => openWindow('settings')}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 p-4 min-h-0 overflow-y-auto custom-scrollbar" ref={scrollRef}>
        <div className="space-y-4 pb-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-primary text-primary-foreground ml-2' : 'bg-blue-600 text-white mr-2'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>
                <div className={`p-3 rounded-xl text-sm ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-none' 
                    : 'bg-muted rounded-tl-none border border-border shadow-sm'
                }`}>
                  <div className={`prose prose-sm dark:prose-invert max-w-none ${msg.role === 'user' ? 'text-primary-foreground' : ''}`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex max-w-[85%] flex-row">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-blue-600 text-white mr-2">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-xl bg-muted rounded-tl-none border border-border flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-3 bg-background border-t mt-auto">
        <form 
          onSubmit={e => { e.preventDefault(); handleSend(); }}
          className="flex items-center space-x-2 bg-muted/50 rounded-full border p-1 pr-2"
        >
          <Input 
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about the file, or use @exam-notes..."
            className="flex-1 border-0 bg-transparent focus-visible:ring-0 shadow-none h-10"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={!input.trim() || isLoading}
            className="h-8 w-8 rounded-full shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <div className="text-[10px] text-center text-muted-foreground mt-2 px-4">
          AI can make mistakes. Consider verifying important information.
        </div>
      </div>
    </div>
  );
}
