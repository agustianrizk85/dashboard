/* Messaging (Chat) client — DMs + per-division channels + file attachments.
 * Talks to the messaging endpoints on the auth service (same base + same token
 * the whole dashboard already uses). Realtime is a Server-Sent Events stream. */

const AUTH = ((import.meta.env.VITE_AUTH_API as string) ?? "/api").replace(/\/$/, "");
const TOKEN_KEY = "gp_dashboard_token";

const token = () => localStorage.getItem(TOKEN_KEY) ?? "";

export interface DirUser {
  id: string;
  username: string;
  name: string;
}
export interface Conversation {
  userId: string;
  name: string;
  username: string;
  last: string;
  lastAt: number;
  unread: number;
}
export interface Channel {
  code: string;
  name: string;
  last: string;
  lastAt: number;
  unread: number;
}
export interface Attachment {
  id: string;
  name: string;
  size: number;
  mime: string;
}
export interface ChatMessage {
  id: string;
  from: string;
  fromName: string;
  body: string;
  createdAt: number;
  mine: boolean;
  att?: Attachment;
}

async function req<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Authorization: "Bearer " + token() };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${AUTH}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      /* no json */
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function upload<T>(path: string, file: File, body: string): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  if (body) fd.append("body", body);
  const res = await fetch(`${AUTH}${path}`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token() },
    body: fd,
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const chatApi = {
  users: () => req<DirUser[]>("GET", "/messages/users"),
  conversations: () => req<Conversation[]>("GET", "/messages/conversations"),
  channels: () => req<Channel[]>("GET", "/messages/channels"),
  unread: () => req<{ count: number }>("GET", "/messages/unread"),
  // Direct messages
  thread: (userId: string) => req<ChatMessage[]>("GET", `/messages/with/${userId}`),
  send: (userId: string, body: string) => req<unknown>("POST", `/messages/with/${userId}`, { body }),
  sendFile: (userId: string, file: File, body: string) => upload(`/messages/with/${userId}/file`, file, body),
  markRead: (userId: string) => req<{ status: string }>("POST", `/messages/with/${userId}/read`),
  // Per-division channels
  channelThread: (code: string) => req<ChatMessage[]>("GET", `/messages/channel/${code}`),
  channelSend: (code: string, body: string) => req<unknown>("POST", `/messages/channel/${code}`, { body }),
  channelSendFile: (code: string, file: File, body: string) => upload(`/messages/channel/${code}/file`, file, body),
  channelMarkRead: (code: string) => req<{ status: string }>("POST", `/messages/channel/${code}/read`),
};

/** Fetch an attachment (with auth) and return an object URL for inline display /
 *  download. The caller revokes it when done. */
export async function attachmentUrl(attId: string): Promise<string> {
  const res = await fetch(`${AUTH}/messages/file/${attId}`, { headers: { Authorization: "Bearer " + token() } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

/** Open the realtime SSE stream. Calls `onRev` on every server revision push. */
export function subscribeChat(onRev: () => void): () => void {
  const es = new EventSource(`${AUTH}/messages/stream?token=${encodeURIComponent(token())}`);
  es.onmessage = () => onRev();
  return () => es.close();
}
