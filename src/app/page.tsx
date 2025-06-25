'use client';

import { useState } from 'react';
import { ResearchReport, SupportedModel } from '@/lib/types';
import { ResearchForm } from '@/components/ResearchForm';
import { StatusWindow } from '@/components/StatusWindow';
import { ReportDisplay } from '@/components/ReportDisplay';
import { ChatInterface } from '@/components/ChatInterface';
import { Github, Sparkles } from 'lucide-react';

type AppState = 'IDLE' | 'SEARCHING' | 'REPORT_READY';
interface StatusMessage { type: string; data: any; }

export default function Home() {
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
  const [finalReport, setFinalReport] = useState<ResearchReport | null>(null);

  const handleResearchSubmit = async (formData: { query: string; depth: number; breadth: number; model: SupportedModel }) => {
    setAppState('SEARCHING');
    setStatusMessages([]);
    setFinalReport(null);

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
          } catch (e) {
            console.error('Failed to parse stream chunk:', e);
          }
        }
      }
    }
  };

  return (
    <main className="min-h-screen bg-white text-gray-900 font-sans">
      <div className="container mx-auto px-4 py-8 flex flex-col items-center">
        <header className="text-center mb-10">
          <h1 className="text-5xl font-extrabold tracking-tight flex items-center gap-3">
            <Sparkles className="h-10 w-10 text-blue-600" />
            <span>Autonomous Research Engine</span>
          </h1>
          <p className="text-gray-500 mt-2 text-lg">
            Your AI-powered copilot for turning complex topics into structured reports.
          </p>
        </header>

        {appState === 'IDLE' && (
          <ResearchForm onSubmit={handleResearchSubmit} isLoading={false} />
        )}
        
        {appState === 'SEARCHING' && (
          <>
            <ResearchForm onSubmit={handleResearchSubmit} isLoading={true} />
            <div className="mt-8 w-full">
              <StatusWindow messages={statusMessages} />
            </div>
          </>
        )}
        
        {appState === 'REPORT_READY' && finalReport && (
          <div className="w-full flex flex-col items-center gap-8">
            <ReportDisplay report={finalReport} />
            <ChatInterface report={finalReport} />
          </div>
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