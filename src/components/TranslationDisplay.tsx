"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, ChevronRight } from "lucide-react";

interface TranslationDisplayProps {
  originalText: string;
  translatedText: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

export function TranslationDisplay({
  originalText,
  translatedText,
  sourceLanguage,
  targetLanguage,
}: TranslationDisplayProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(translatedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const sourceLangLabel = sourceLanguage || "Source";
  const targetLangLabel = targetLanguage || "Translation";

  return (
    <div className="w-full animate-in fade-in duration-500">
      {/* Card */}
      <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden bg-white">

        {/* Language bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">{sourceLangLabel}</span>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
            <span className="text-sm font-semibold text-blue-600">{targetLangLabel}</span>
          </div>
          <span className="text-xs text-gray-400 tabular-nums">
            {originalText.length} → {translatedText.length} chars
          </span>
        </div>

        {/* Content split */}
        <div className="flex flex-col md:flex-row min-h-[180px]">

          {/* Source — 35% */}
          <div className="md:w-[35%] flex flex-col border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50/60">
            <div className="px-4 pt-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                {sourceLangLabel}
              </span>
            </div>
            <div className="px-4 pb-4 flex-1">
              <p className="text-gray-500 whitespace-pre-wrap text-[14px] leading-relaxed">
                {originalText}
              </p>
            </div>
          </div>

          {/* Target — 65% */}
          <div className="md:w-[65%] flex flex-col bg-white">
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-500">
                {targetLangLabel}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className={`flex items-center gap-1.5 text-xs h-7 px-2.5 rounded-md transition-all duration-200 ${
                  isCopied
                    ? "text-green-600 bg-green-50 hover:bg-green-50"
                    : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                {isCopied ? (
                  <><Check className="h-3.5 w-3.5" />Copied!</>
                ) : (
                  <><Copy className="h-3.5 w-3.5" />Copy</>
                )}
              </Button>
            </div>
            <div className="px-4 pb-4 flex-1">
              <p className="text-gray-900 font-medium whitespace-pre-wrap text-[15px] leading-relaxed">
                {translatedText}
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

