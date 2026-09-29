import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ChatMessage } from "./mockGame";
import Icon from "./Icon";

type ChatProps = {
  messages: ChatMessage[];
  currentUserId: string;
  onMessage: (text: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  systemMessage?: string;
};

export default function Chat({
  messages,
  currentUserId,
  onMessage,
  systemMessage,
  disabled = false,
  placeholder = "Type a message…",
}: ChatProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messageList = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = messageList.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || disabled || sending) return;
    setSending(true);
    try {
      await onMessage(text);
      setDraft("");
    } catch {
      /* The shared connection notification reports the error; keep the draft. */
    } finally {
      setSending(false);
    }
  }

  return (
    <aside aria-label="Chat" className="panel flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div
        ref={messageList}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-relevant="additions"
        className="scroll-area min-h-0 flex-1 overflow-y-auto p-4"
      >
        <div className="flex flex-col gap-4">
          {systemMessage && (
            <p className="py-1 text-xs leading-relaxed text-muted">{systemMessage}</p>
          )}
          {messages.map((message) =>
            message.author ? (
              <div
                key={message.id}
                className="chat-message"
                data-own={message.authorId === currentUserId}
              >
                <p className="chat-author">
                  {message.authorId === currentUserId ? "You" : message.author}
                </p>
                <p className="chat-bubble">{message.text}</p>
              </div>
            ) : (
              <p
                key={message.id}
                className="py-1 text-xs leading-relaxed text-muted [overflow-wrap:anywhere]"
              >
                {message.text}
              </p>
            ),
          )}
        </div>
      </div>
      <form onSubmit={sendMessage} className="p-3 pt-0">
        <label htmlFor="chat-message" className="sr-only">
          Chat message
        </label>
        <div className="flex items-center gap-1 rounded-ui border border-line bg-[#f8fbff] p-1">
          <input
            id="chat-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={disabled || sending}
            maxLength={200}
            autoComplete="off"
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[13px] placeholder:text-muted"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={disabled || sending || !draft.trim()}
            className="flex size-8 shrink-0 items-center justify-center rounded-ui bg-primary text-white enabled:hover:bg-accent"
          >
            <Icon name="send" size={16} />
          </button>
        </div>
      </form>
    </aside>
  );
}
