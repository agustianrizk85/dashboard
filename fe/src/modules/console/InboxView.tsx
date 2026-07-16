import { MessagesPane } from "@/messaging/MessagesPane";

/** Kotak Masuk — 1:1 direct messages ("japri") per person, with files &
 *  realtime. Division group chat lives in Chat; approval notifications stay in
 *  the Persetujuan menu. */
export function InboxView() {
  return <MessagesPane mode="dms" />;
}
