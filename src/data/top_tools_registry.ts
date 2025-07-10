// data/top_tools_registry.ts

/**
 * Defines a static registry of "top used" tools for each application,
 * including their descriptions for LLM context.
 * The LLM will use these descriptions to decide which specific tools
 * (if any) are directly relevant, or if a broader search is needed.
 */
interface ToolDescription {
  description: string;
}

interface AppToolsMap {
  [toolName: string]: ToolDescription;
}

export const TOP_TOOLS_REGISTRY: { [appName: string]: AppToolsMap } = {
  GMAIL: {
    GMAIL_SEND_EMAIL: {
      description:
        "Sends an email via gmail api using the authenticated user's google profile display name, requiring is html=true if the body contains html and valid s3key, mimetype, name for any attachment.",
    },
    GMAIL_FETCH_EMAILS: {
      description:
        "Fetches a list of email messages from a gmail account, supporting filtering, pagination, and optional full content retrieval.",
    },
    GMAIL_CREATE_EMAIL_DRAFT: {
      description:
        "Creates a gmail email draft, supporting to/cc/bcc, subject, plain/html body (ensure is html=true for html), attachments, and threading.",
    },
    GMAIL_REPLY_TO_THREAD: {
      description:
        "Sends a reply within a specific gmail thread using the original thread's subject, requiring a valid thread id and correctly formatted email addresses.",
    },
    GMAIL_FETCH_MESSAGE_BY_THREAD_ID: {
      description:
        "Retrieves messages from a gmail thread using its thread id, where the thread must be accessible by the specified user id.",
    },
    GMAIL_SEND_DRAFT: {
      description:
        "Sends the specified, existing draft to the recipients in the to, cc, and bcc headers.",
    },
    GMAIL_ADD_LABEL_TO_EMAIL: {
      description:
        "Adds and/or removes specified gmail labels for a message; ensure message id and all label ids are valid (use 'listlabels' for custom label ids).",
    },
    GMAIL_GET_CONTACTS: {
      description:
        "Fetches contacts (connections) for the authenticated google account, allowing selection of specific data fields and pagination.",
    },
    GMAIL_SEARCH_PEOPLE: {
      description:
        "Searches contacts by matching the query against names, nicknames, emails, phone numbers, and organizations, optionally including 'other contacts'.",
    },
    GMAIL_MOVE_TO_TRASH: {
      description:
        "Moves an existing, non-deleted email message to the trash for the specified user.",
    },
  },
  GOOGLECALENDAR: {
    GOOGLECALENDAR_CREATE_EVENT: {
      description:
        "Creates an event on a google calendar, needing rfc3339 utc start/end times (end after start) and write access to the calendar.",
    },
    GOOGLECALENDAR_EVENTS_LIST: {
      description: "Returns events on the specified calendar.",
    },
    GOOGLECALENDAR_FIND_EVENT: {
      description:
        "Finds events in a specified google calendar using text query, time ranges (event start/end, last modification), and event types; ensure `timemin` is not chronologically after `timemax` if both are provided.",
    },
    GOOGLECALENDAR_PATCH_EVENT: {
      description:
        "Updates specified fields of an existing event in a google calendar using patch semantics (array fields like `attendees` are fully replaced if provided); ensure the `calendar id` and `event id` are valid and the user has write access to the calendar.",
    },
    GOOGLECALENDAR_DELETE_EVENT: {
      description:
        "Deletes a specified event by `event id` from a google calendar (`calendar id`); this action is idempotent and raises a 404 error if the event is not found.",
    },
    GOOGLECALENDAR_FIND_FREE_SLOTS: {
      description:
        "Finds free/busy time slots in google calendars for specified calendars within a defined time range (defaults to the current day utc if `time min`/`time max` are omitted), enhancing busy intervals with event details; `time min` must precede `time max` if both are provided.",
    },
    GOOGLECALENDAR_QUICK_ADD: {
      description:
        "Parses natural language text to quickly create a basic google calendar event with its title, date, and time, suitable for simple scheduling; does not support recurring events or direct attendee addition via parameters, and `calendar id` must be valid if not 'primary'.",
    },
    GOOGLECALENDAR_LIST_CALENDARS: {
      description:
        "Retrieves calendars from the user's google calendar list, with options for pagination and filtering.",
    },
    GOOGLECALENDAR_GET_CURRENT_DATE_TIME: {
      description:
        "Gets the current date and time, allowing for a specific timezone offset.",
    },
    GOOGLECALENDAR_REPLY_TO_THREAD: {
      description:
        "Sends a reply within a specific gmail thread using the original thread's subject, requiring a valid `thread id` and correctly formatted email addresses.",
    },
  },
  GOOGLEDRIVE: {
    GOOGLEDRIVE_CREATE_FILE_FROM_TEXT: {
      description:
        "Creates a new file in google drive from provided text content (up to 10mb), supporting various formats including automatic conversion to google workspace types.",
    },
    GOOGLEDRIVE_UPLOAD_FILE: {
      description:
        "Uploads a file (max 5mb) to google drive, moving it to a specified folder if a valid folder id is provided, otherwise uploads to root.",
    },
    GOOGLEDRIVE_LIST_FILES: {
      description:
        "Tool to list a user's files and folders in google drive. use this to search or browse for files and folders based on various criteria.",
    },
    GOOGLEDRIVE_DOWNLOAD_FILE: {
      description:
        "Downloads a file from google drive by its id, optionally exporting google workspace documents (docs, sheets, slides) to a specified `mime type`; for other file types, `mime type` must be omitted.",
    },
    GOOGLEDRIVE_FIND_FILE: {
      description:
        "Tool to list or search for files and folders in google drive. use when you need to find specific files based on query criteria or list contents of a drive/folder.",
    },
    GOOGLEDRIVE_EDIT_FILE: {
      description:
        "Updates an existing google drive file by overwriting its entire content with new text (max 10mb).",
    },
    GOOGLEDRIVE_CREATE_FOLDER: {
      description:
        "Creates a new folder in google drive, optionally within a parent folder specified by its id or name; if a parent name is provided but not found, the action will fail.",
    },
    GOOGLEDRIVE_ADD_FILE_SHARING_PREFERENCE: {
      description:
        "Modifies sharing permissions for an existing google drive file, granting a specified role to a user, group, domain, or 'anyone'.",
    },
    GOOGLEDRIVE_MOVE_FILE: {
      description:
        "Tool to move a file from one folder to another in google drive. use when you need to reorganize files by changing their parent folder(s).",
    },
    GOOGLEDRIVE_GOOGLE_DRIVE_DELETE_FOLDER_OR_FILE_ACTION: {
      description:
        "Tool to delete a file or folder in google drive. use when you need to permanently remove a specific file or folder using its id. note: this action is irreversible.",
    },
  },
  GOOGLEDOCS: {
    GOOGLEDOCS_CREATE_DOCUMENT: {
      description:
        "Creates a new google docs document using the provided title as filename and inserts the initial text at the beginning if non-empty, returning the document's id and metadata (excluding body content).",
    },
    GOOGLEDOCS_GET_DOCUMENT_BY_ID: {
      description:
        "Retrieves an existing google document by its id; will error if the document is not found.",
    },
    GOOGLEDOCS_INSERT_TEXT_ACTION: {
      description:
        "Tool to insert a string of text at a specified location within a google document. use when you need to add new text content to an existing document.",
    },
    GOOGLEDOCS_REPLACE_ALL_TEXT: {
      description:
        "Tool to replace all occurrences of a specified text string with another text string throughout a google document. use when you need to perform a global find and replace operation within a document.",
    },
    GOOGLEDOCS_UPDATE_EXISTING_DOCUMENT: {
      description:
        "Applies programmatic edits, such as text insertion, deletion, or formatting, to a specified google doc using the `batchupdate` api method.",
    },
    GOOGLEDOCS_SEARCH_DOCUMENTS: {
      description:
        "Search for google documents using various filters including name, content, date ranges, and more.",
    },
    GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN: {
      description:
        "Creates a new google docs document, optionally initializing it with a title and content provided as markdown text.",
    },
    GOOGLEDOCS_UPDATE_DOCUMENT_MARKDOWN: {
      description:
        "Replaces the entire content of an existing google docs document with new markdown text; requires edit permissions for the document.",
    },
    GOOGLEDOCS_DELETE_CONTENT_RANGE: {
      description:
        "Tool to delete a range of content from a google document. use when you need to remove a specific portion of text or other structural elements within a document.",
    },
    GOOGLEDOCS_COPY_DOCUMENT: {
      description:
        "Tool to create a copy of an existing google document. use this to duplicate a document, for example, when using an existing document as a template. the copied document will have a default title (e.g., 'copy of [original title]') if no new title is provided, and will be placed in the user's root google drive folder.",
    },
  },
  NOTION: {
    NOTION_CREATE_NOTION_PAGE: {
      description: "Creates a new page in a notion workspace.",
    },
    NOTION_ADD_PAGE_CONTENT: {
      description:
        "Appends a single content block to a notion page or a parent block (must be page, toggle, to-do, bulleted/numbered list, callout, or quote); invoke repeatedly to add multiple blocks.",
    },
    NOTION_QUERY_DATABASE: {
      description:
        "Queries a notion database for pages (rows), where rows are pages and columns are properties; ensure sort property names correspond to existing database properties.",
    },
    NOTION_INSERT_ROW_DATABASE: {
      description: "Creates a new page (row) in a specified notion database.",
    },
    NOTION_UPDATE_ROW_DATABASE: {
      description:
        "Updates or archives an existing notion database row (page) using its `row id`, allowing modification of its icon, cover, and/or properties; ensure the target page is accessible and property details (names/ids and values) align with the database schema and specified formats.",
    },
    NOTION_SEARCH_NOTION_PAGE: {
      description:
        "Searches notion pages and databases by title; an empty query lists all accessible items, useful for discovering ids or as a fallback when a specific query yields no results.",
    },
    NOTION_FETCH_NOTION_BLOCK: {
      description:
        "Retrieves a notion block (or page, as pages are blocks) using its valid uuid; if the block has children, use a separate action to fetch them.",
    },
    NOTION_FETCH_NOTION_CHILD_BLOCK: {
      description:
        "Retrieves a paginated list of direct, first-level child block objects for a given parent notion block or page id; use block ids from the response for subsequent calls to access deeply nested content.",
    },
    NOTION_NOTION_UPDATE_BLOCK: {
      description:
        "Updates an existing notion block's textual content or type-specific properties (e.g., 'checked' status, 'color'), using its `block id` and the specified `block type`.",
    },
    NOTION_DELETE_BLOCK: {
      description:
        "Archives a notion block, page, or database using its id, which sets its 'archived' property to true (like moving to \"trash\" in the ui) and allows it to be restored later.",
    },
  }
};

/**
 * Retrieves the map of top tool names to their descriptions for a given application.
 * @param appName The name of the application.
 * @returns A map of tool names to ToolDescription objects, or an empty object if no top tools are defined for the app.
 */
export function getTopToolDescriptionsForApp(appName: string): AppToolsMap {
  return TOP_TOOLS_REGISTRY[appName] || {};
}

export function getAllAvailableAppNames(): string[] {
  return Object.keys(TOP_TOOLS_REGISTRY);
}
