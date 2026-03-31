export interface ComposioTool {
  name: string;
  appName: string;
  description: string;
  icon: string;
}

export const AVAILABLE_TOOLS: ComposioTool[] = [
  {
    name: "Google Super",
    appName: "GOOGLESUPER",
    description:
      "Access your Google Workspace Suite, including Gmail, Calendar, Drive, and more.",
    icon: "https://placehold.co/40x40/FF0000/FFFFFF?text=GS",
  },
  {
    name: "Gmail",
    appName: "GMAIL",
    description:
      "Access your Gmail inbox, read and send emails, and search through your messages.",
    icon: "https://placehold.co/40x40/EA4335/FFFFFF?text=GM",
  },
  {
    name: "Calendar",
    appName: "GOOGLECALENDAR",
    description:
      "Manage your Google Calendar events, set up appointments, and check your schedule.",
    icon: "https://placehold.co/40x40/4285F4/FFFFFF?text=GC",
  },
  {
    name: "Drive",
    appName: "GOOGLEDRIVE",
    description:
      "Access files stored in your Google Drive, upload documents, and share content.",
    icon: "https://placehold.co/40x40/34A853/FFFFFF?text=GD",
  },
  {
    name: "Notion",
    appName: "NOTION",
    description:
      "Access your Notion pages, create and edit content, and manage your workspace.",
    icon: "https://placehold.co/40x40/000000/FFFFFF?text=N",
  },
  {
    name: "Docs",
    appName: "GOOGLEDOCS",
    description:
      "Access files stored in your Google Drive, upload documents, and share content.",
    icon: "https://placehold.co/40x40/34A853/FFFFFF?text=GD",
  },
];
