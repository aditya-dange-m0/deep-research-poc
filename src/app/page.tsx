// "use client";

// import { useState, useMemo } from "react";
// import { useChat } from "@ai-sdk/react";
// import { ResearchReport, SupportedModel, FactCheckReport } from "@/lib/types";
// import { ResearchForm } from "@/components/ResearchForm";
// import { StatusWindow } from "@/components/StatusWindow";
// import { ReportDisplay } from "@/components/ReportDisplay";
// import { ChatInterface } from "@/components/ChatInterface";
// import { WindowWrapper } from "@/components/WindowWrapper";
// import { FactCheckDisplay } from "@/components/FactCheckDisplay";
// import { TranslationDisplay } from "@/components/TranslationDisplay"; // Import the new component

// import {
//   Github,
//   Sparkles,
//   PencilRuler,
//   BotMessageSquare,
//   FileText,
//   BadgeCheck as CheckBadge,
// } from "lucide-react";

// type AppState =
//   | "IDLE"
//   | "SEARCHING"
//   | "REPORT_READY"
//   | "FACT_CHECK_COMPLETE"
//   | "TRANSLATION_COMPLETE"; // <-- Add new state
// interface StatusMessage {
//   type: string;
//   data: any;
// }

// export default function Home() {
//   const [translationResult, setTranslationResult] = useState<string | null>(
//     null
//   );
//   const [appState, setAppState] = useState<AppState>("IDLE");
//   const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
//   const [finalReport, setFinalReport] = useState<ResearchReport | null>(null);
//   const [factCheckReport, setFactCheckReport] =
//     useState<FactCheckReport | null>(null); // <-- State for fact-check result
//   const [originalQuery, setOriginalQuery] = useState(""); // <-- State to store the claim

//   // --- FIX 1: State now tracks the report and chat windows separately ---
//   const [windowStates, setWindowStates] = useState({
//     form: "open",
//     report: "open",
//     chat: "open", // New state for the chat window
//   });

//   const handleToggleWindow = (windowName: "form" | "report" | "chat") => {
//     setWindowStates((prev) => ({
//       ...prev,
//       [windowName]: prev[windowName] === "open" ? "minimized" : "open",
//     }));
//   };

//   // --- FIX 2: The useChat hook is LIFTED UP to the parent component ---
//   // It is initialized once and its state persists here.
//   const chatBody = useMemo(() => {
//     return finalReport ? { reportContext: JSON.stringify(finalReport) } : {};
//   }, [finalReport]);

//   const {
//     messages,
//     input,
//     handleInputChange,
//     handleSubmit,
//     isLoading: isChatLoading,
//   } = useChat({
//     id: "report-chat", // Use a static ID to ensure the same chat session is used
//     api: "/api/chat",
//     body: chatBody,
//   });
//   // --- END OF FIX 2 ---

//   const handleResearchSubmit = async (formData: {
//     query: string;
//     depth: number;
//     breadth: number;
//     model: SupportedModel;
//     taskType: "research" | "fact-check";
//   }) => {
//     setAppState("SEARCHING");
//     setStatusMessages([]);
//     setFinalReport(null);
//     setFactCheckReport(null); // Reset fact-check report
//     setOriginalQuery(formData.query); // Store the original query/claim
//     setWindowStates({ form: "minimized", report: "open", chat: "open" });
//     setOriginalQuery(formData.query);

//     const payload = {
//       initialQuery: formData.query,
//       taskType: formData.taskType,
//       model: formData.model,
//       // Only include depth and breadth if the task is 'research'
//       ...(formData.taskType === "research" && {
//         depth: formData.depth,
//         breadth: formData.breadth,
//       }),
//     };
//     // ... (fetch logic remains the same)
//     const response = await fetch("/api/research", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(payload), // Send the corrected payload
//     });

//     if (!response.body) return;
//     const reader = response.body.getReader();
//     const decoder = new TextDecoder();
//     let buffer = "";

//     while (true) {
//       const { done, value } = await reader.read();
//       if (done) break;

//       buffer += decoder.decode(value, { stream: true });
//       const lines = buffer.split("\n");
//       buffer = lines.pop() || "";

//       for (const line of lines) {
//         if (line.startsWith("data: ")) {
//           try {
//             const json = JSON.parse(line.substring(6));
//             if (json.type === "translation-result") {
//               setTranslationResult(json.data.translatedText);
//             }
//             if (json.type === "done") {
//               if (translationResult) setAppState("TRANSLATION_COMPLETE");
//               else if (factCheckReport) setAppState("FACT_CHECK_COMPLETE");
//               else setAppState("REPORT_READY");
//               return;
//             }
//             setStatusMessages((prev) => [...prev, json]);
//           } catch (e) {
//             console.error("Failed to parse stream chunk:", e);
//           }
//         }
//       }
//     }
//   };

//   return (
//     <main className="min-h-screen bg-gray-50 text-gray-900 font-sans">
//       <div className="container mx-auto px-4 py-8 flex flex-col items-center space-y-8">
//         <header className="text-center">
//           <h1 className="text-5xl font-extrabold tracking-tight flex items-center gap-3">
//             <Sparkles className="h-10 w-10 text-blue-600" />
//             <span>Autonomous Research Engine</span>
//           </h1>
//           <p className="text-gray-500 mt-2 text-lg">
//             Your AI-powered copilot for turning complex topics into structured
//             reports.
//           </p>
//         </header>

//         <WindowWrapper
//           title="Configure Research"
//           icon={<PencilRuler className="h-6 w-6 text-gray-700" />}
//           isMinimized={windowStates.form === "minimized"}
//           onToggle={() => handleToggleWindow("form")}
//         >
//           <ResearchForm
//             onSubmit={handleResearchSubmit}
//             isLoading={appState === "SEARCHING"}
//           />
//         </WindowWrapper>

//         {appState === "SEARCHING" && <StatusWindow messages={statusMessages} />}

//         {appState === "REPORT_READY" && finalReport && (
//           <>
//             {/* --- FIX 1: Report is now in its own minimizable window --- */}
//             <WindowWrapper
//               title="Generated Research Report"
//               icon={<FileText className="h-6 w-6 text-purple-600" />}
//               isMinimized={windowStates.report === "minimized"}
//               onToggle={() => handleToggleWindow("report")}
//               className="w-full max-w-3xl"
//             >
//               <ReportDisplay report={finalReport} />
//             </WindowWrapper>

//             <WindowWrapper
//               title="Ask About The Report"
//               icon={<BotMessageSquare className="h-6 w-6 text-blue-600" />}
//               isMinimized={windowStates.chat === "minimized"}
//               onToggle={() => handleToggleWindow("chat")}
//               className="w-full max-w-3xl"
//             >
//               <ChatInterface
//                 messages={messages}
//                 input={input}
//                 handleInputChange={handleInputChange}
//                 handleSubmit={handleSubmit}
//                 isLoading={isChatLoading}
//               />
//             </WindowWrapper>
//           </>
//         )}
//         {appState === "TRANSLATION_COMPLETE" && translationResult && (
//           <TranslationDisplay
//             originalText={originalQuery}
//             translatedText={translationResult}
//           />
//         )}
//         {appState === "FACT_CHECK_COMPLETE" && factCheckReport && (
//           <WindowWrapper
//             title="Fact-Check Result"
//             icon={<CheckBadge className="h-6 w-6 text-green-600" />}
//             isMinimized={windowStates.report === "minimized"}
//             onToggle={() => handleToggleWindow("report")}
//             className="w-full max-w-3xl"
//           >
//             <FactCheckDisplay claim={originalQuery} report={factCheckReport} />
//           </WindowWrapper>
//         )}

//         <footer className="text-center mt-12 text-gray-500">
//           <a
//             href="https://github.com/your-repo"
//             target="_blank"
//             rel="noopener noreferrer"
//             className="inline-flex items-center gap-2 hover:text-blue-600 transition-colors"
//           >
//             <Github className="h-4 w-4" /> View on GitHub
//           </a>
//         </footer>
//       </div>
//     </main>
//   );
// }

"use client";

import { useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { ResearchReport, SupportedModel, FactCheckReport } from "@/lib/types";
import { ResearchForm, TaskType } from "@/components/ResearchForm";
import { StatusWindow } from "@/components/StatusWindow";
import { ReportDisplay } from "@/components/ReportDisplay";
import { FactCheckDisplay } from "@/components/FactCheckDisplay";
import { TranslationDisplay } from "@/components/TranslationDisplay";
import { ChatInterface } from "@/components/ChatInterface";
import { WindowWrapper } from "@/components/WindowWrapper";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

import {
  Github,
  Sparkles,
  PencilRuler,
  BotMessageSquare,
  FileText,
  BadgeCheck,
  Loader2,
} from "lucide-react";

// Define all possible states for the application UI
type AppState =
  | "IDLE"
  | "SEARCHING"
  | "TRANSLATING"
  | "REPORT_READY"
  | "FACT_CHECK_COMPLETE"
  | "TRANSLATION_COMPLETE";

interface StatusMessage {
  type: string;
  data: any;
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("IDLE");
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
  const [finalReport, setFinalReport] = useState<ResearchReport | null>(null);
  const [factCheckReport, setFactCheckReport] =
    useState<FactCheckReport | null>(null);
  const [translationResult, setTranslationResult] = useState<{
    originalText: string;
    translatedText: string;
  } | null>(null);
  const [originalQuery, setOriginalQuery] = useState("");

  const [windowStates, setWindowStates] = useState({
    form: "open",
    report: "open",
    chat: "open",
  });

  const handleToggleWindow = (windowName: "form" | "report" | "chat") => {
    setWindowStates((prev) => ({
      ...prev,
      [windowName]: prev[windowName] === "open" ? "minimized" : "open",
    }));
  };

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: handleChatSubmit,
    isLoading: isChatLoading,
  } = useChat({
    id: "report-chat",
    api: "/api/chat",
    body: useMemo(
      () => (finalReport ? { reportContext: JSON.stringify(finalReport) } : {}),
      [finalReport]
    ),
  });

  const resetAllStates = () => {
    setStatusMessages([]);
    setFinalReport(null);
    setFactCheckReport(null);
    setTranslationResult(null);
  };

  const handleResearchSubmit = async (formData: {
    query: string;
    depth: number;
    breadth: number;
    model: SupportedModel;
    searchProvider: "google" | "exa";
    taskType: "research" | "fact-check";
  }) => {
    setAppState("SEARCHING");
    resetAllStates();
    setOriginalQuery(formData.query);
    setWindowStates({ form: "minimized", report: "open", chat: "open" });

    const payload = {
      initialQuery: formData.query,
      taskType: formData.taskType,
      model: formData.model,
      ...(formData.taskType === "research" && {
        depth: formData.depth,
        breadth: formData.breadth,
        searchProvider: formData.searchProvider,
      }),
    };

    const response = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let tempFactCheckReport = null;
    let tempFinalReport = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const json = JSON.parse(line.substring(6));
            if (json.type === "report") tempFinalReport = json.data.report;
            if (json.type === "fact-check-report")
              tempFactCheckReport = json.data.report;
            if (json.type === "done") {
              // Set state based on which report was found during the stream
              if (tempFactCheckReport) {
                setFactCheckReport(tempFactCheckReport);
                setAppState("FACT_CHECK_COMPLETE");
              } else if (tempFinalReport) {
                setFinalReport(tempFinalReport);
                setAppState("REPORT_READY");
              }
              return;
            }
            setStatusMessages((prev) => [...prev, json]);
          } catch (e) {
            console.error("Failed to parse stream chunk:", e);
          }
        }
      }
    }
  };

  const handleTranslateSubmit = async (formData: {
    query: string;
    targetLanguage: string;
    model: SupportedModel;
  }) => {
    setAppState("TRANSLATING");
    resetAllStates();

    const payload = {
      text: formData.query,
      targetLanguage: formData.targetLanguage,
      model: formData.model,
    };

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Translation API failed with status ${response.status}`
        );
      }

      const result = await response.json();
      setTranslationResult(result);
      setAppState("TRANSLATION_COMPLETE");
    } catch (error) {
      console.error("Translation failed:", error);
      setAppState("IDLE");
    }
  };

  const handleFormSubmit = (formData: any) => {
    if (formData.taskType === "translation") {
      handleTranslateSubmit(formData);
    } else {
      handleResearchSubmit(formData);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <div className="container mx-auto px-4 py-8 flex flex-col items-center space-y-8">
        <header className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight flex items-center gap-3">
            <Sparkles className="h-10 w-10 text-blue-600" />
            <span>Autonomous AI Engine</span>
          </h1>
          <p className="text-gray-500 mt-2 text-lg">
            Your copilot for research, fact-checking, and translation.
          </p>
        </header>
        {/* --- NEW: Redirection Button to Super Agent --- */}
          <div className="mt-4">
            <Link href="/agent" passHref>
              <Button variant="outline" className="text-lg py-6 px-8 border-2 border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700">
                Switch to Genspark Super Agent
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
          {/* --- END OF NEW SECTION --- */}

        <WindowWrapper
          title="Configure Task"
          icon={<PencilRuler className="h-6 w-6 text-gray-700" />}
          isMinimized={windowStates.form === "minimized"}
          onToggle={() => handleToggleWindow("form")}
        >
          <ResearchForm
            onSubmit={handleFormSubmit}
            isLoading={appState === "SEARCHING" || appState === "TRANSLATING"}
          />
        </WindowWrapper>

        {appState === "SEARCHING" && <StatusWindow messages={statusMessages} />}
        {appState === "TRANSLATING" && (
          <div className="flex items-center gap-2 text-lg text-gray-600">
            <Loader2 className="h-6 w-6 animate-spin" />
            Translating...
          </div>
        )}

        {appState === "REPORT_READY" && finalReport && (
          <>
            <WindowWrapper
              title="Generated Research Report"
              icon={<FileText className="h-6 w-6 text-purple-600" />}
              isMinimized={windowStates.report === "minimized"}
              onToggle={() => handleToggleWindow("report")}
              className="w-full max-w-3xl"
            >
              <ReportDisplay report={finalReport} />
            </WindowWrapper>
            <WindowWrapper
              title="Ask About The Report"
              icon={<BotMessageSquare className="h-6 w-6 text-blue-600" />}
              isMinimized={windowStates.chat === "minimized"}
              onToggle={() => handleToggleWindow("chat")}
              className="w-full max-w-3xl"
            >
              <ChatInterface
                messages={messages}
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleChatSubmit}
                isLoading={isChatLoading}
              />
            </WindowWrapper>
          </>
        )}

        {appState === "FACT_CHECK_COMPLETE" && factCheckReport && (
          <WindowWrapper
            title="Fact-Check Result"
            icon={<BadgeCheck className="h-6 w-6 text-green-600" />}
            isMinimized={windowStates.report === "minimized"}
            onToggle={() => handleToggleWindow("report")}
            className="w-full max-w-3xl"
          >
            <FactCheckDisplay claim={originalQuery} report={factCheckReport} />
          </WindowWrapper>
        )}

        {appState === "TRANSLATION_COMPLETE" && translationResult && (
          <TranslationDisplay
            originalText={translationResult.originalText}
            translatedText={translationResult.translatedText}
          />
        )}

        <footer className="text-center mt-12 text-gray-500">
          <a
            href="https://github.com/your-repo"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:text-blue-600 transition-colors"
          >
            <Github className="h-4 w-4" /> View on GitHub
          </a>
        </footer>
      </div>
    </main>
  );
}
