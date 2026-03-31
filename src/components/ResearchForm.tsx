"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supportedModels, SupportedModel } from "@/lib/types";
import { Loader, ArrowLeftRight } from "lucide-react";

export type TaskType = "research" | "fact-check" | "translation";

const COMMON_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Chinese (Simplified)",
  "Chinese (Traditional)",
  "Japanese",
  "Arabic",
  "Hindi",
  "Portuguese",
  "Russian",
  "Korean",
  "Italian",
  "Dutch",
  "Turkish",
  "Polish",
  "Swedish",
  "Vietnamese",
  "Thai",
  "Indonesian",
];

interface ResearchFormProps {
  onSubmit: (formData: any) => void;
  isLoading: boolean;
}

export function ResearchForm({ onSubmit, isLoading }: ResearchFormProps) {
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState(2);
  const [breadth, setBreadth] = useState(2);
  const [model, setModel] = useState<SupportedModel>("google:gemini-3-flash-preview");
  const [taskType, setTaskType] = useState<TaskType>("research");
  const [searchProvider, setSearchProvider] = useState<"google" | "exa">("exa");

  // Translation language state
  const [sourceLanguage, setSourceLanguage] = useState("English");
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [customSource, setCustomSource] = useState("");
  const [customTarget, setCustomTarget] = useState("");

  const handleTaskTypeChange = (v: string) => {
    setTaskType(v as TaskType);
    setQuery(""); // Clear input when switching task tabs
  };

  const handleSwapLanguages = () => {
    const prevSource = sourceLanguage === "custom" ? customSource : sourceLanguage;
    const prevTarget = targetLanguage === "custom" ? customTarget : targetLanguage;

    if (COMMON_LANGUAGES.includes(prevTarget)) {
      setSourceLanguage(prevTarget);
      setCustomSource("");
    } else {
      setSourceLanguage("custom");
      setCustomSource(prevTarget);
    }

    if (COMMON_LANGUAGES.includes(prevSource)) {
      setTargetLanguage(prevSource);
      setCustomTarget("");
    } else {
      setTargetLanguage("custom");
      setCustomTarget(prevSource);
    }
  };

  const getResolvedSourceLanguage = () => {
    if (sourceLanguage === "custom") return customSource.trim() || "English";
    return sourceLanguage;
  };

  const getResolvedTargetLanguage = () => {
    if (targetLanguage === "custom") return customTarget.trim() || "Spanish";
    return targetLanguage;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSubmit({
      query,
      depth,
      breadth,
      model,
      taskType,
      targetLanguage: getResolvedTargetLanguage(),
      sourceLanguage: getResolvedSourceLanguage(),
      searchProvider,
    });
  };

  const getPlaceholderText = () => {
    if (taskType === "research")
      return "e.g., The impact of quantum computing on cryptography...";
    if (taskType === "fact-check")
      return "e.g., Study shows drinking coffee cures cancer...";
    return "Enter the text you want to translate...";
  };

  const taskLabels: Record<TaskType, string> = {
    research: "Start Research",
    "fact-check": "Check Fact",
    translation: "Translate",
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Start a New Task</CardTitle>
        <CardDescription>
          Select a task and configure the AI agent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Task type selector */}
          <RadioGroup
            defaultValue="research"
            onValueChange={handleTaskTypeChange}
            className="grid grid-cols-3 gap-2 rounded-lg border p-2"
          >
            {(
              [
                { value: "research", id: "r1", label: "Deep Research" },
                { value: "fact-check", id: "r2", label: "Fact-Check" },
                { value: "translation", id: "r3", label: "Translate" },
              ] as const
            ).map(({ value, id, label }) => (
              <div key={value}>
                <RadioGroupItem value={value} id={id} className="peer sr-only" />
                <Label
                  htmlFor={id}
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  {label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {/* Main input */}
          <div className="space-y-2">
            <Label htmlFor="query">
              {taskType === "translation"
                ? "Text to Translate"
                : taskType === "fact-check"
                ? "Claim to Verify"
                : "Research Topic"}
            </Label>
            <Textarea
              id="query"
              placeholder={getPlaceholderText()}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              required
              rows={taskType === "translation" ? 5 : 3}
            />
          </div>

          {/* Translation language selector */}
          {taskType === "translation" && (
            <div className="space-y-2">
              <Label>Languages</Label>

              {/* Inline row: From [select] ⇄ To [select] */}
              <div className="flex items-center gap-2">
                {/* From label + select */}
                <span className="text-xs text-muted-foreground shrink-0">From</span>
                <Select
                  value={sourceLanguage}
                  onValueChange={(v) => { setSourceLanguage(v); setCustomSource(""); }}
                >
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>

                {/* Swap */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={handleSwapLanguages}
                  title="Swap languages"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </Button>

                {/* To label + select */}
                <span className="text-xs text-muted-foreground shrink-0">To</span>
                <Select
                  value={targetLanguage}
                  onValueChange={(v) => { setTargetLanguage(v); setCustomTarget(""); }}
                >
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom inputs — shown below the row if needed */}
              {(sourceLanguage === "custom" || targetLanguage === "custom") && (
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    {sourceLanguage === "custom" && (
                      <Input
                        placeholder="From language (e.g., Bengali)"
                        value={customSource}
                        onChange={(e) => setCustomSource(e.target.value)}
                        className="h-8 text-sm"
                      />
                    )}
                  </div>
                  <div>
                    {targetLanguage === "custom" && (
                      <Input
                        placeholder="To language (e.g., Swahili)"
                        value={customTarget}
                        onChange={(e) => setCustomTarget(e.target.value)}
                        className="h-8 text-sm"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Research-only options */}
          {taskType === "research" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="search-provider">Search Provider</Label>
                  <Select
                    value={searchProvider}
                    onValueChange={(v) => setSearchProvider(v as any)}
                  >
                    <SelectTrigger id="search-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exa">Exa.ai (Neural)</SelectItem>
                      <SelectItem value="google">Google (Keyword)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="depth">Depth</Label>
                  <Input
                    id="depth"
                    type="number"
                    min="1"
                    max="3"
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
              </div>
            </>
          )}

          {/* Model selector */}
          <div className="space-y-2">
            <Label htmlFor="model">AI Model</Label>
            <Select
              value={model}
              onValueChange={(v) => setModel(v as SupportedModel)}
            >
              <SelectTrigger id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supportedModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            className="w-full text-lg p-6"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              taskLabels[taskType]
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
