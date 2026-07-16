import { MessagesPane } from "./MessagesPane";

/** Chat — per-division group channels (Kantor Direktur → Chat). Direct messages
 *  live in Kotak Masuk instead. */
export function ChatView() {
  return <MessagesPane mode="channels" />;
}
