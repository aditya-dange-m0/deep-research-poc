import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

interface TranslationDisplayProps {
  originalText: string;
  translatedText: string;
}

export function TranslationDisplay({
  originalText,
  translatedText,
}: TranslationDisplayProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(translatedText);
  };

  return (
    <div className="w-full max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500">
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-2">Original Text</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{originalText}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Translated Text</h3>
            <Button variant="ghost" size="icon" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-gray-900 font-medium whitespace-pre-wrap">
            {translatedText}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
