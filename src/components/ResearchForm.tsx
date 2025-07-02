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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Import RadioGroup
import { supportedModels, SupportedModel } from "@/lib/types";
import { Loader } from "lucide-react";

export type TaskType = "research" | "fact-check" | "translation";

interface ResearchFormProps {
  onSubmit: (formData: any) => void; // Use 'any' for flexibility, validation happens on the backend
  isLoading: boolean;
}

export function ResearchForm({ onSubmit, isLoading }: ResearchFormProps) {
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState(2);
  const [breadth, setBreadth] = useState(2);
  const [model, setModel] = useState<SupportedModel>("openai:gpt-4o-mini");
  const [taskType, setTaskType] = useState<TaskType>("research");
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [searchProvider, setSearchProvider] = useState<"google" | "exa">("exa"); // Default to Exa

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    const formData = {
      query,
      depth,
      breadth,
      model,
      taskType,
      targetLanguage,
      searchProvider,
    };
    onSubmit(formData);
  };

  const getPlaceholderText = () => {
    if (taskType === "research")
      return "e.g., The impact of quantum computing...";
    if (taskType === "fact-check")
      return "e.g., Study shows drinking coffee cures...";
    return "Enter the text you want to translate...";
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
          <RadioGroup
            defaultValue="research"
            onValueChange={(v) => setTaskType(v as TaskType)}
            className="grid grid-cols-3 gap-2 rounded-lg border p-2"
          >
            <div>
              <RadioGroupItem
                value="research"
                id="r1"
                className="peer sr-only"
              />
              <Label
                htmlFor="r1"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                Deep Research
              </Label>
            </div>
            <div>
              <RadioGroupItem
                value="fact-check"
                id="r2"
                className="peer sr-only"
              />
              <Label
                htmlFor="r2"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                Fact-Check
              </Label>
            </div>
            <div>
              <RadioGroupItem
                value="translation"
                id="r3"
                className="peer sr-only"
              />
              <Label
                htmlFor="r3"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                Translate
              </Label>
            </div>
          </RadioGroup>

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
            />
          </div>

          {/* Conditionally show this section for research tasks */}
          {taskType === "research" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* ... depth and breadth inputs ... */}
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
            </>
          )}

          {taskType === "translation" && (
            <div className="space-y-2">
              <Label htmlFor="target-language">Target Language</Label>
              <Input
                id="target-language"
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
              />
            </div>
          )}

          {taskType === "research" && (
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
          )}

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
              "Start Task"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
