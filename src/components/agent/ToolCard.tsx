"use client"
import { Card, CardHeader, CardTitle, CardDescription, CardFooter, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CheckCircle, PlusCircle, Loader2 } from "lucide-react"

interface Tool {
  name: string
  appName: string
  description: string
  icon: string
  isInstalled: boolean
  connectionStatus?: 'INITIATED' | 'ACTIVE' | 'INACTIVE' | null;
  connectedAccountId?: string;
}

interface ToolCardProps {
  tool: Tool
  onInstall: (appName: string) => void
  isInstalling: boolean
}

export function ToolCard({ tool, onInstall, isInstalling }: ToolCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getConnectionStatusColor = (status: string | undefined | null) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'INITIATED':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  }

  const getConnectionStatusText = (status: string | undefined | null) => {
    switch (status) {
      case 'ACTIVE':
        return 'Connected';
      case 'INITIATED':
        return 'Connecting...';
      default:
        return 'Connect';
    }
  }

  return (
    <Card className="bg-white border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-md group">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 border border-gray-200">
            <AvatarImage src={tool.icon || "/placeholder.svg"} alt={`${tool.name} icon`} className="object-cover" />
            <AvatarFallback className="bg-blue-50 text-blue-600 text-sm font-medium">
              {getInitials(tool.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold text-gray-900 leading-tight">{tool.name}</CardTitle>
            <p className="text-sm text-gray-500 mt-1">{tool.appName}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-4">
        <CardDescription className="text-gray-600 text-sm leading-relaxed line-clamp-3">
          {tool.description}
        </CardDescription>
      </CardContent>

      <CardFooter className="pt-0">
        {tool.connectionStatus === 'ACTIVE' ? (
          <Button disabled className="w-full bg-green-50 text-green-700 border border-green-200">
            <CheckCircle className="mr-2 h-4 w-4" />
            Connected
          </Button>
        ) : (
          <Button
            onClick={() => onInstall(tool.appName)}
            disabled={isInstalling || tool.connectionStatus === 'INITIATED'}
            className={`w-full ${getConnectionStatusColor(tool.connectionStatus)}`}
          >
            {isInstalling || tool.connectionStatus === 'INITIATED' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tool.connectionStatus === 'INITIATED' ? 'Connecting...' : 'Connecting...'}
              </>
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                Connect
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
