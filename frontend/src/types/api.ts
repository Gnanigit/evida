// Shapes returned by the Evida FastAPI backend (see backend/app/api/*).

export type CurrentUser = {
  id: string;
  email: string | null;
};

export type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  created_at: string;
};

// Document sources: { source, page, document_id }.
// Web sources:      { source, url, type: "web" }.
export type Source = {
  source?: string | null;
  page?: number | null;
  document_id?: string | null;
  url?: string | null;
  type?: string | null;
};

export type ChatResponse = {
  conversation_id: string;
  question: string;
  answer: string;
  sources: Source[];
  messages: Message[];
};

export type DocumentRecord = {
  id: string;
  filename: string;
  storage_path: string;
  content_type: string;
  created_at: string;
  indexed_at: string | null;
};

export type IndexResult = {
  message: string;
  document_id: string;
  filename: string;
  chunks_indexed: number;
};

export type DeleteResult = {
  message: string;
  id: string;
};
