"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };
type Chat = { id: string; title: string; messages: Message[]; updatedAt: number };
const STORAGE_KEY = "ing-chats-v1";
const MEMORY_KEY = "ing-memories-v1";

function newChat(): Chat { return { id: crypto.randomUUID(), title: "New chat", messages: [], updatedAt: Date.now() }; }

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState("");
  const [memories, setMemories] = useState<string[]>([]);
  const [memoryInput, setMemoryInput] = useState("");
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    try {
      const savedChats = localStorage.getItem(STORAGE_KEY);
      const parsedChats = savedChats ? (JSON.parse(savedChats) as Chat[]) : [];
      const first = parsedChats.length ? parsedChats : [newChat()];
      setChats(first);
      setActiveId(first[0].id);
      const savedMemories = localStorage.getItem(MEMORY_KEY);
      const parsedMemories = savedMemories ? JSON.parse(savedMemories) : [];
      setMemories(Array.isArray(parsedMemories) ? parsedMemories : []);
    } catch {
      const chat = newChat(); setChats([chat]); setActiveId(chat.id);
    }
  }, []);

  useEffect(() => { if (chats.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); }, [chats]);
  useEffect(() => { localStorage.setItem(MEMORY_KEY, JSON.stringify(memories)); }, [memories]);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeId) ?? chats[0], [chats, activeId]);
  const messages = activeChat?.messages ?? [];

  function createChat() { const chat = newChat(); setChats((current) => [chat, ...current]); setActiveId(chat.id); setInput(""); }
  function selectChat(id: string) { setActiveId(id); setInput(""); setSidebarOpen(false); }
  function deleteChat(id: string) {
    setChats((current) => {
      const remaining = current.filter((chat) => chat.id !== id);
      if (!remaining.length) { const chat = newChat(); setActiveId(chat.id); return [chat]; }
      if (id === activeId) setActiveId(remaining[0].id);
      return remaining;
    });
  }
  function addMemory(value: string) {
    const memory = value.trim();
    if (!memory) return;
    setMemories((current) => current.includes(memory) ? current : [...current, memory]);
    setMemoryInput("");
  }
  function removeMemory(index: number) { setMemories((current) => current.filter((_, i) => i !== index)); }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || loading || !activeChat) return;
    const nextMessages = [...activeChat.messages, { role: "user" as const, content: text }];
    setChats((current) => current.map((chat) => chat.id === activeChat.id ? { ...chat, messages: nextMessages, title: chat.messages.length ? chat.title : text.slice(0, 42), updatedAt: Date.now() } : chat));
    setInput(""); setLoading(true);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: nextMessages, memories }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Something went wrong.");
      setChats((current) => current.map((chat) => chat.id === activeChat.id ? { ...chat, messages: [...nextMessages, { role: "assistant", content: data.text }], updatedAt: Date.now() } : chat));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setChats((current) => current.map((chat) => chat.id === activeChat.id ? { ...chat, messages: [...nextMessages, { role: "assistant", content: `Sorry — ${message}` }], updatedAt: Date.now() } : chat));
    } finally { setLoading(false); }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }

  return (
    <main className="app-shell">
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-head"><div className="brand"><span className="logo">I</span> Ing</div><button className="close-sidebar" onClick={() => setSidebarOpen(false)} aria-label="Close">×</button></div>
        <button className="new-chat" onClick={createChat}>＋ New chat</button>
        <button className="memory-button" onClick={() => setMemoryOpen((open) => !open)}>🧠 Memory <span>{memories.length}</span></button>
        {memoryOpen && <div className="memory-panel">
          <p>Things Ing remembers. You control them.</p>
          <form onSubmit={(event) => { event.preventDefault(); addMemory(memoryInput); }} className="memory-form"><input value={memoryInput} onChange={(event) => setMemoryInput(event.target.value)} placeholder="Add a memory…" /><button type="submit">+</button></form>
          {memories.length === 0 ? <div className="empty-memory">No memories yet.</div> : memories.map((memory, index) => <div className="memory-item" key={`${memory}-${index}`}><span>{memory}</span><button onClick={() => removeMemory(index)} aria-label="Delete memory">×</button></div>)}
          {memories.length > 0 && <button className="clear-memory" onClick={() => setMemories([])}>Clear all memories</button>}
        </div>}
        <div className="history-label">Your chats</div>
        <div className="history-list">{[...chats].sort((a, b) => b.updatedAt - a.updatedAt).map((chat) => <div className={`history-item ${chat.id === activeId ? "active" : ""}`} key={chat.id}><button className="history-button" onClick={() => selectChat(chat.id)}>{chat.title}</button><button className="delete-chat" onClick={() => deleteChat(chat.id)} aria-label={`Delete ${chat.title}`}>×</button></div>)}</div>
        <div className="memory-note">💾 Chats and memories are saved in this browser.</div>
      </aside>

      <section className="main-panel">
        <header className="topbar"><button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">☰</button><div className="mobile-title">{activeChat?.title || "Ing"}</div><div className="status">AI assistant</div></header>
        <section className="chat">
          {messages.length === 0 ? <div className="welcome"><h1>How can I help?</h1><p>Ask Ing anything. Your chats and memories will stay here.</p></div> : <div className="messages">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="avatar">{message.role === "user" ? "You" : "I"}</div><div className="bubble">{message.content}</div></div>)}{loading && <div className="message assistant"><div className="avatar">I</div><div className="bubble">Thinking…</div></div>}</div>}
          <form className="composer" onSubmit={sendMessage}><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} placeholder="Message Ing…" rows={1} disabled={loading} /><button className="send" type="submit" disabled={!input.trim() || loading} aria-label="Send">↑</button></form>
          <div className="hint">Enter to send · Shift+Enter for a new line</div>
        </section>
      </section>
    </main>
  );
}
