"use client";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToolCard } from "./ToolCard";
import { getAvailableComposioTools } from "@/lib/agent-backend/composioService";
import { Loader2 } from "lucide-react";

interface Tool {
  name: string;
  appName: string;
  description: string;
  icon: string;
  isInstalled: boolean;
  connectionStatus?: "INITIATED" | "ACTIVE" | "INACTIVE" | null;
  connectedAccountId?: string;
}

interface ToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
}

export function ToolsModal({ isOpen, onClose, sessionId }: ToolsModalProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [activeConnections, setActiveConnections] = useState<Record<string, string>>({});

  // Poll for connection status
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    const pollConnectionStatus = async () => {
      const toolsWithPendingConnections = tools.filter(
        tool => tool.connectionStatus === 'INITIATED' && tool.connectedAccountId
      );

      for (const tool of toolsWithPendingConnections) {
        try {
          const response = await fetch('/api/agent/connect/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectedAccountId: tool.connectedAccountId })
          });

          const data = await response.json();
          
          if (data.success) {
            setTools(prev => 
              prev.map(t => 
                t.appName === tool.appName 
                  ? { ...t, connectionStatus: data.status }
                  : t
              )
            );

            if (data.status === 'ACTIVE') {
              setActiveConnections(prev => ({
                ...prev,
                [tool.appName]: tool.connectedAccountId!
              }));
            }
          }
        } catch (error) {
          console.error('Error polling connection status:', error);
        }
      }
    };

    if (isOpen && tools.some(tool => tool.connectionStatus === 'INITIATED')) {
      pollInterval = setInterval(pollConnectionStatus, 5000); // Poll every 5 seconds
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isOpen, tools]);

  useEffect(() => {
    if (isOpen && sessionId) {
      const fetchTools = async () => {
        setIsLoading(true);
        try {
          const mockToolsRaw = await getAvailableComposioTools();
          const mockTools: Tool[] = mockToolsRaw.map((tool: any) => ({
            ...tool,
            connectionStatus: activeConnections[tool.appName] ? 'ACTIVE' : null,
            connectedAccountId: activeConnections[tool.appName]
          }));
          setTools(mockTools);
        } catch (error) {
          console.error('Error fetching tools:', error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchTools();
    }
  }, [isOpen, sessionId, activeConnections]);

  const handleInstall = async (appName: string) => {
    if (!sessionId) return;
    setIsInstalling(true);
    try {
      const response = await fetch("/api/agent/connect/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName, userId: sessionId }),
      });
      const data = await response.json();
      
      if (data.success && data.connectedAccountId) {
        // Update tool status to INITIATED
        setTools(prev =>
          prev.map(tool =>
            tool.appName === appName
              ? {
                  ...tool,
                  connectionStatus: 'INITIATED',
                  connectedAccountId: data.connectedAccountId
                }
              : tool
          )
        );

        // Open authentication window
        if (data.redirectUrl) {
          window.open(data.redirectUrl, '_blank', 'width=600,height=800');
        }
      } else {
        console.error("Failed to initiate connection:", data.error);
      }
    } catch (error) {
      console.error("Error during installation:", error);
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white border-gray-200 text-gray-900 w-[95vw] max-w-3xl h-[85vh] p-0 rounded-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">
              Connect Tools
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-2">
              Install tools to give your agent new abilities. Your connections
              are managed by Composio.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable Content Area with fixed height */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                  <p className="text-gray-600">Loading available tools...</p>
                </div>
              ) : tools.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-center">
                    No tools available at the moment.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                  {tools.map((tool) => (
                    <ToolCard
                      key={tool.appName}
                      tool={tool}
                      onInstall={handleInstall}
                      isInstalling={isInstalling}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
