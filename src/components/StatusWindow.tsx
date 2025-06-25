import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle, BrainCircuit, FileText, Filter, PenTool } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface StatusMessage {
  type: string;
  data: any;
}


const getIcon = (type: string) => {
  switch (type) {
    case 'query-start': return <Search className="h-4 w-4 text-blue-600" />;4
    case 'refining-query': return <PenTool className="h-4 w-4 text-cyan-600" />; // <-- ADD new case
    case 'relevance-check': return <Filter className="h-4 w-4 text-orange-600" />; 
    case 'learning': return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'report': return <FileText className="h-4 w-4 text-purple-600" />;
    default: return <BrainCircuit className="h-4 w-4 text-gray-500" />;
  }
};

const getMessage = (msg: StatusMessage): string => {
    switch (msg.type) {
      case 'query-start':
        return `Thinking about: "${msg.data}"`;
      case 'relevance-check':
        return `Filtering sources for relevance...`;
      case 'refining-query':
        return `Optimizing search for: "${msg.data.query}"`;
      case 'learning':
        // Added a check to prevent errors if learning or url is missing
        if (msg.data?.learning?.url) {
            try {
                return `Found an insight from: ${new URL(msg.data.learning.url).hostname}`;
            } catch {
                return `Found an insight from an unknown source.`;
            }
        }
        return 'Extracted a learning.';
      case 'report':
        return `Synthesizing final report...`;
      case 'token-usage':
        return `Processed a step...`;
      case 'error':
        return `An error occurred: ${msg.data}`;
      default:
        return 'Agent is working...';
    }
}
export function StatusWindow({ messages }: { messages: StatusMessage[] }) {
  return (
    <Card className="w-full max-w-2xl mx-auto animate-in fade-in duration-500">
        <CardHeader>
            <CardTitle className="flex items-center gap-3">
                <BrainCircuit className="h-6 w-6 text-blue-600 animate-pulse" />
                <span>Deep Research in Progress...</span>
            </CardTitle>
        </CardHeader>
        <CardContent>
            <ScrollArea className="h-48 pr-4">
              <div className="flex flex-col gap-3">
                {messages.map((msg, index) => (
                  <div key={index} className="flex items-center gap-3 text-sm text-gray-700">
                    {getIcon(msg.type)}
                    <span>{getMessage(msg)}</span>
                    {msg.type.includes('usage') && (
                      <Badge variant="secondary">
                        Tokens: {msg.data.usage.inputTokens + msg.data.usage.outputTokens}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
        </CardContent>
    </Card>
  );
}