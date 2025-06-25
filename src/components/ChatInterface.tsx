'use client';

// --- FIX: Import useMemo from React ---
import { useMemo } from 'react';
import { useChat } from 'ai/react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, User, Bot } from 'lucide-react';
import { ResearchReport } from '@/lib/types';

export function ChatInterface({ report }: { report: ResearchReport }) {
  // --- FIX: Memoize the body object so it's stable across re-renders ---
  const chatBody = useMemo(() => {
    return { reportContext: JSON.stringify(report) };
  }, [report]); // This will only re-create the object if the report prop changes

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
    // --- FIX: Use the stable, memoized body object ---
    body: chatBody,
  });

  return (
    <Card className="w-full max-w-3xl mx-auto mt-8 animate-in fade-in duration-500">
      <CardHeader>
        <CardTitle>Ask About The Report</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 pr-4">
          {messages.map(m => (
            <div key={m.id} className={`flex gap-3 my-4 text-sm ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && <Bot className="w-6 h-6 text-blue-600 flex-shrink-0" />}
              <div className={`p-3 rounded-lg ${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
                <p className="leading-relaxed">{m.content}</p>
              </div>
              {m.role === 'user' && <User className="w-6 h-6 flex-shrink-0" />}
            </div>
          ))}
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="e.g., Elaborate on the first section..."
            />
            <Button type="submit" size="icon">
                <Send className="h-4 w-4" />
            </Button>
        </form>
      </CardFooter>
    </Card>
  );
}