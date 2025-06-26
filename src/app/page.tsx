'use client';

import { useState, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { ResearchReport, SupportedModel } from '@/lib/types';
import { ResearchForm } from '@/components/ResearchForm';
import { StatusWindow } from '@/components/StatusWindow';
import { ReportDisplay } from '@/components/ReportDisplay';
import { ChatInterface } from '@/components/ChatInterface';
import { WindowWrapper } from '@/components/WindowWrapper';
import { Github, Sparkles, PencilRuler, BotMessageSquare, FileText } from 'lucide-react';

type AppState = 'IDLE' | 'SEARCHING' | 'REPORT_READY';
interface StatusMessage { type: string; data: any; }

export default function Home() {
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
  const [finalReport, setFinalReport] = useState<ResearchReport | null>(null);

  // --- FIX 1: State now tracks the report and chat windows separately ---
  const [windowStates, setWindowStates] = useState({
    form: 'open',
    report: 'open',
    chat: 'open', // New state for the chat window
  });

  const handleToggleWindow = (windowName: 'form' | 'report' | 'chat') => {
    setWindowStates(prev => ({
      ...prev,
      [windowName]: prev[windowName] === 'open' ? 'minimized' : 'open',
    }));
  };

  // --- FIX 2: The useChat hook is LIFTED UP to the parent component ---
  // It is initialized once and its state persists here.
  const chatBody = useMemo(() => {
    return finalReport ? { reportContext: JSON.stringify(finalReport) } : {};
  }, [finalReport]);

  const { messages, input, handleInputChange, handleSubmit, isLoading: isChatLoading } = useChat({
    id: 'report-chat', // Use a static ID to ensure the same chat session is used
    api: '/api/chat',
    body: chatBody,
  });
  // --- END OF FIX 2 ---

  const handleResearchSubmit = async (formData: { query: string; depth: number; breadth: number; model: SupportedModel }) => {
    setAppState('SEARCHING');
    setStatusMessages([]);
    setFinalReport(null);
    setWindowStates({ form: 'minimized', report: 'open', chat: 'open' });

    // ... (fetch logic remains the same)
    const response = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialQuery: formData.query, ...formData }),
    });

    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.substring(6));
            if(json.type === 'report') setFinalReport(json.data.report);
            if (json.type === 'done') {
                setAppState('REPORT_READY');
                return;
            }
            setStatusMessages(prev => [...prev, json]);
          } catch (e) { console.error('Failed to parse stream chunk:', e); }
        }
      }
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <div className="container mx-auto px-4 py-8 flex flex-col items-center space-y-8">
        <header className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight flex items-center gap-3">
            <Sparkles className="h-10 w-10 text-blue-600" />
            <span>Autonomous Research Engine</span>
          </h1>
          <p className="text-gray-500 mt-2 text-lg">
            Your AI-powered copilot for turning complex topics into structured reports.
          </p>
        </header>

        <WindowWrapper
          title="Configure Research"
          icon={<PencilRuler className="h-6 w-6 text-gray-700" />}
          isMinimized={windowStates.form === 'minimized'}
          onToggle={() => handleToggleWindow('form')}
        >
          <ResearchForm 
            onSubmit={handleResearchSubmit} 
            isLoading={appState === 'SEARCHING'} 
          />
        </WindowWrapper>

        {appState === 'SEARCHING' && <StatusWindow messages={statusMessages} />}
        
        {appState === 'REPORT_READY' && finalReport && (
          <>
            {/* --- FIX 1: Report is now in its own minimizable window --- */}
            <WindowWrapper
              title="Generated Research Report"
              icon={<FileText className="h-6 w-6 text-purple-600" />}
              isMinimized={windowStates.report === 'minimized'}
              onToggle={() => handleToggleWindow('report')}
              className="w-full max-w-3xl"
            >
              <ReportDisplay report={finalReport} />
            </WindowWrapper>

            {/* --- FIX 1: Chat is now in its own separate minimizable window --- */}
            <WindowWrapper
              title="Ask About The Report"
              icon={<BotMessageSquare className="h-6 w-6 text-blue-600" />}
              isMinimized={windowStates.chat === 'minimized'}
              onToggle={() => handleToggleWindow('chat')}
              className="w-full max-w-3xl"
            >
              <ChatInterface 
                messages={messages}
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                isLoading={isChatLoading}
              />
            </WindowWrapper>
          </>
        )}

        <footer className="text-center mt-12 text-gray-500">
            <a href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-blue-600 transition-colors">
                <Github className="h-4 w-4"/> View on GitHub
            </a>
        </footer>
      </div>
    </main>
  );
}