"use client"
import { useState, useEffect, useRef } from "react"
import type React from "react"

import { useChat } from "ai/react"
import { v4 as uuidv4 } from "uuid"
import { User, Bot, Search, Settings, Plug, WandSparkles, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ToolsModal } from "@/components/agent/ToolsModal"
import { PersonalizationSheet } from "@/components/agent/PersonalizationSheet"

export default function AgentPage() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isToolsModalOpen, setIsToolsModalOpen] = useState(false)
  const [isPersonalizationSheetOpen, setIsPersonalizationSheetOpen] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sessionId) {
      setSessionId(uuidv4())
    }
  }, [sessionId])

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: "/api/agent/chat",
    body: { userId: sessionId },
    id: sessionId || undefined,
    onError: (error) => {
      console.error("Chat error:", error)
    },
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages, isLoading])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    handleSubmit(e)
  }

  return (
    <div className="flex h-screen w-full flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 bg-white/80 backdrop-blur-sm flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <WandSparkles className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Genspark Super Agent</h1>
                <p className="text-sm text-gray-500">Your AI assistant for any task</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPersonalizationSheetOpen(true)}
                className="text-gray-600 hover:text-gray-900"
              >
                <Settings className="h-4 w-4 mr-2" />
                Personalize
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsToolsModalOpen(true)}
                className="text-gray-600 hover:text-gray-900"
              >
                <Plug className="h-4 w-4 mr-2" />
                Tools
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Messages with proper scrolling */}
      <div className="flex-1 overflow-hidden pb-32">
        {/* Added pb-32 to account for fixed input area */}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl mb-6">
              <WandSparkles className="h-12 w-12 text-blue-600 mx-auto" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">How can I help you today?</h2>
            <p className="text-gray-600 mb-8 max-w-md">
              Ask anything, create anything. Connect tools to give me more abilities.
            </p>
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-2xl">
              <div className="p-4 border border-gray-200 rounded-xl hover:border-blue-200 hover:bg-blue-50/50 transition-colors cursor-pointer">
                <Search className="h-5 w-5 text-blue-600 mb-2" />
                <h3 className="font-medium text-gray-900 mb-1">Research</h3>
                <p className="text-sm text-gray-600">Deep dive into any topic</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-xl hover:border-blue-200 hover:bg-blue-50/50 transition-colors cursor-pointer">
                <Bot className="h-5 w-5 text-blue-600 mb-2" />
                <h3 className="font-medium text-gray-900 mb-1">Create</h3>
                <p className="text-sm text-gray-600">Generate content and ideas</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-xl hover:border-blue-200 hover:bg-blue-50/50 transition-colors cursor-pointer">
                <WandSparkles className="h-5 w-5 text-blue-600 mb-2" />
                <h3 className="font-medium text-gray-900 mb-1">Analyze</h3>
                <p className="text-sm text-gray-600">Process and understand data</p>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="max-w-4xl mx-auto px-4 py-4">
              <div className="space-y-6">
                {messages.map((message, index) => (
                  <div key={message.id || index} className="flex gap-4 group">
                    <div className="flex-shrink-0">
                      {message.role === "user" ? (
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-600" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Bot className="h-4 w-4 text-blue-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {message.role === "user" ? "You" : "Genspark"}
                        </span>
                      </div>
                      <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                        {message.content || "No content"}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Bot className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">Genspark</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white/95 backdrop-blur-sm p-4 z-10">
        <form onSubmit={onSubmit} className="max-w-3xl mx-auto">
          <div className="relative">
            <Textarea
              value={input}
              onChange={handleInputChange}
              placeholder="Message Genspark Super Agent..."
              className="w-full bg-gray-50 border-gray-200 rounded-2xl px-4 py-3 pr-12 resize-none focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  onSubmit(e as any)
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 rounded-xl h-8 w-8"
              disabled={isLoading || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">Error: {error.message}</p>}
        </form>
        <div className="flex items-center justify-center mt-3">
          <p className="text-xs text-gray-400">
            Genspark Super Agent may display inaccurate info. Verify important information.
          </p>
        </div>
      </div>

      <ToolsModal isOpen={isToolsModalOpen} onClose={() => setIsToolsModalOpen(false)} sessionId={sessionId} />
      <PersonalizationSheet isOpen={isPersonalizationSheetOpen} onClose={() => setIsPersonalizationSheetOpen(false)} />
    </div>
  )
}
