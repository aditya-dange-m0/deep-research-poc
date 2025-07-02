'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
// --- FIX: Import the correct FactCheckReport type ---
import { FactCheckReport } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Check, X, AlertTriangle, Scale, HelpCircle } from 'lucide-react';
import React from 'react';

const verdictConfig = {
    'True': { color: 'bg-green-100 text-green-800 border-green-300', icon: <Check/> },
    'Mostly True': { color: 'bg-green-100 text-green-700 border-green-300', icon: <Check/> },
    'Misleading': { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: <AlertTriangle/> },
    'False': { color: 'bg-red-100 text-red-800 border-red-300', icon: <X/> },
    'Unverifiable': { color: 'bg-gray-100 text-gray-800 border-gray-300', icon: <HelpCircle/> }
};

// --- FIX: Use the correct type for the 'report' prop ---
export function FactCheckDisplay({ claim, report }: { claim: string; report: FactCheckReport }) {
  // This check prevents crashes if the verdict is somehow not in our config
  if (!report?.verdict || !verdictConfig[report.verdict]) {
    return null;
  }
  const config = verdictConfig[report.verdict];
  
  return (
    <Card className="w-full max-w-3xl mx-auto animate-in fade-in duration-500">
      <CardHeader>
        <CardDescription>Fact-Check Result for: "{claim}"</CardDescription>
        <CardTitle className="flex items-center gap-3">
             <Badge className={`${config.color} text-lg px-4 py-1`}>
                {React.cloneElement(config.icon, { className: 'h-5 w-5 mr-2' })}
                {report.verdict}
            </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
            <h3 className="font-semibold mb-2">Summary</h3>
            <p className="text-gray-700">{report.summary}</p>
        </div>
        {report.supportingEvidence.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 text-green-700">Supporting Sources</h3>
            <ul className="list-disc pl-5 space-y-1">
              {report.supportingEvidence.map((url, i) => <li key={i}><a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{new URL(url).hostname}</a></li>)}
            </ul>
          </div>
        )}
        {report.refutingEvidence.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 text-red-700">Refuting Sources</h3>
             <ul className="list-disc pl-5 space-y-1">
              {report.refutingEvidence.map((url, i) => <li key={i}><a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{new URL(url).hostname}</a></li>)}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}