import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResearchReport } from '@/lib/types';
import { Copy, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ReportDisplay({ report }: { report: ResearchReport }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    alert('Report JSON copied to clipboard!');
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto animate-in fade-in duration-500">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">{report.title}</CardTitle>
      </CardHeader>
      <CardContent className="prose max-w-none">
        <div className="p-4 bg-gray-50 rounded-md mb-6 border">
          <h3 className="font-semibold mb-2 text-lg text-gray-900">Executive Summary</h3>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.summary}</ReactMarkdown>
        </div>
        {report.sections.map((section, index) => (
          <div key={index} className="mt-6">
            <h3 className="font-semibold mb-2 text-lg text-gray-900">{section.title}</h3>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleCopy}><Copy className="mr-2 h-4 w-4" /> Copy JSON</Button>
        <Button onClick={handleDownload}><Download className="mr-2 h-4 w-4" /> Download JSON</Button>
      </CardFooter>
    </Card>
  );
}