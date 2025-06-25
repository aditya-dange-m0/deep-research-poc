'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { supportedModels, SupportedModel } from '@/lib/types';
import { Loader } from 'lucide-react';

interface ResearchFormProps {
  onSubmit: (formData: { query: string; depth: number; breadth: number; model: SupportedModel }) => void;
  isLoading: boolean;
}

export function ResearchForm({ onSubmit, isLoading }: ResearchFormProps) {
  const [query, setQuery] = useState('');
  const [depth, setDepth] = useState(2);
  const [breadth, setBreadth] = useState(2);
  const [model, setModel] = useState<SupportedModel>('google:gemini-1.5-flash-latest');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSubmit({ query, depth, breadth, model });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Start New Research</CardTitle>
        <CardDescription>Configure the AI agent for your deep research task.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="query">Research Topic</Label>
            <Textarea
              id="query"
              placeholder="e.g., Analyze the impact of quantum computing on modern cryptography"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-24"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="depth">Depth</Label>
              <Input
                id="depth"
                type="number"
                min="1"
                max="5"
                value={depth}
                onChange={(e) => setDepth(parseInt(e.target.value, 10))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="breadth">Breadth</Label>
              <Input
                id="breadth"
                type="number"
                min="1"
                max="5"
                value={breadth}
                onChange={(e) => setBreadth(parseInt(e.target.value, 10))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={model} onValueChange={(v) => setModel(v as SupportedModel)}>
                <SelectTrigger id="model">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {supportedModels.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full text-lg p-6" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader className="mr-2 h-5 w-5 animate-spin" />
                Researching...
              </>
            ) : (
              'Start Deep Research'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}