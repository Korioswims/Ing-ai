"use client";

import { FormEvent, KeyboardEvent, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Something went wrong.");

      setMessages((current) => [...current, { role: "assistant", content: data.text }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setMessages((current) => [...current, { role: "assistant", content: `Sorry — ${message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="logo">I</span> Ing</div>
        <div className="status">AI assistant</div>
      </header>

      <section className="chat">
        {messages.length === 0 ? (
          <div className="welcome">
            <h1>How can I help?</h1>
            <p>Ask Ing anything. Write, learn, brainstorm, plan, or just chat.</p>
          </div>
        ) : (
          <div className="messages">
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <div className="avatar">{message.role === "user" ? "You" : "I"}</div>
                <div className="bubble">{message.content}</div>
              </div>
            ))}
            {loading && (
              <div className="message assistant">
                <div className="avatar">I</div>
                <div className="bubble">Thinking…</div>
              </div>
            )}
          </div>
        )}

        <form className="composer" onSubmit={sendMessage}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message Ing…"
            rows={1}
            disabled={loading}
          />
          <button className="send" type="submit" disabled={!input.trim() || loading} aria-label="Send">↑</button>
        </form>
        <div className="hint">Enter to send · Shift+Enter for a new line</div>
      </section>
    </main>
  );
}
