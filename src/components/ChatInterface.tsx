'use client';

import { useEffect, useRef } from 'react';
import { Message } from 'ai/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, User, Bot, Loader2 } from 'lucide-react';

interface ChatInterfaceProps {
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export function ChatInterface({ 
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading
}: ChatInterfaceProps) {
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'auto',
      });
    }
  }, [messages]);

  return (
    // This component no longer needs its own Card wrapper
    <div className="w-full flex flex-col h-96">
        <ScrollArea className="flex-grow pr-4 mb-4">
            <div ref={scrollAreaRef} className="h-full">
                {messages.map(m => (
                <div key={m.id} className={`flex gap-3 my-4 text-sm ${m.role === 'user' ? 'justify-end' : ''}`}>
                    {m.role === 'assistant' && <Bot className="w-6 h-6 text-blue-600 flex-shrink-0" />}
                    <div className={`p-3 rounded-lg ${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
                    <div className="prose prose-sm max-w-none text-inherit">{m.content}</div>
                    </div>
                    {m.role === 'user' && <User className="w-6 h-6 flex-shrink-0" />}
                </div>
                ))}
                {isLoading && (
                <div className="flex gap-3 my-4 text-sm">
                    <Bot className="w-6 h-6 text-blue-600 flex-shrink-0 animate-pulse" />
                    <div className="p-3 rounded-lg bg-gray-100 flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                </div>
                )}
            </div>
        </ScrollArea>
        <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Elaborate on a section..."
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={!input || isLoading}>
                <Send className="h-4 w-4" />
            </Button>
        </form>
    </div>
  );
}