"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Message = { role: "user" | "assistant"; content: string };
type Chat = { id: string; title: string; messages: Message[]; updatedAt: number };
const STORAGE_KEY = "ing-chats-v1";
const MEMORY_KEY = "ing-memories-v1";
const ING_LOGO = "/icon.svg";

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
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [cloudReady, setCloudReady] = useState(false);

  useEffect(() => {
    const localChats = localStorage.getItem(STORAGE_KEY);
    const localMemories = localStorage.getItem(MEMORY_KEY);
    try {
      const parsedChats = localChats ? JSON.parse(localChats) as Chat[] : [];
      const first = parsedChats.length ? parsedChats : [newChat()];
      setChats(first); setActiveId(first[0].id);
      const parsedMemories = localMemories ? JSON.parse(localMemories) : [];
      setMemories(Array.isArray(parsedMemories) ? parsedMemories : []);
    } catch { const chat = newChat(); setChats([chat]); setActiveId(chat.id); }

    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (chats.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); }, [chats]);
  useEffect(() => { localStorage.setItem(MEMORY_KEY, JSON.stringify(memories)); }, [memories]);

  useEffect(() => {
    if (!supabase || !user) { setCloudReady(false); return; }
    let cancelled = false;
    (async () => {
      const [{ data: cloudChats, error: chatError }, { data: cloudMemories, error: memoryError }] = await Promise.all([
        supabase.from("ing_chats").select("id,title,messages,updated_at").order("updated_at", { ascending: false }),
        supabase.from("ing_memories").select("id,content,created_at").order("created_at", { ascending: true })
      ]);
      if (cancelled) return;
      if (!chatError && cloudChats?.length) {
        const loaded = cloudChats.map((c) => ({ id: c.id, title: c.title, messages: (c.messages || []) as Message[], updatedAt: Date.parse(c.updated_at) || Date.now() }));
        setChats(loaded); setActiveId(loaded[0].id);
      } else if (!chatError && chats.length) {
        await supabase.from("ing_chats").upsert(chats.map((c) => ({ id: c.id, user_id: user.id, title: c.title, messages: c.messages, updated_at: new Date(c.updatedAt).toISOString() })));
      }
      if (!memoryError && cloudMemories?.length) setMemories(cloudMemories.map((m) => m.content));
      else if (!memoryError && memories.length) await supabase.from("ing_memories").insert(memories.map((content) => ({ user_id: user.id, content })));
      setCloudReady(!chatError && !memoryError);
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function syncChat(chat: Chat) {
    if (!supabase || !user || !cloudReady) return;
    await supabase.from("ing_chats").upsert({ id: chat.id, user_id: user.id, title: chat.title, messages: chat.messages, updated_at: new Date(chat.updatedAt).toISOString() });
  }
  async function syncMemoryList(next: string[]) {
    if (!supabase || !user || !cloudReady) return;
    await supabase.from("ing_memories").delete().eq("user_id", user.id);
    if (next.length) await supabase.from("ing_memories").insert(next.map((content) => ({ user_id: user.id, content })));
  }

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeId) ?? chats[0], [chats, activeId]);
  const messages = activeChat?.messages ?? [];

  function createChat() { const chat = newChat(); setChats((current) => [chat, ...current]); setActiveId(chat.id); setInput(""); }
  function selectChat(id: string) { setActiveId(id); setInput(""); setSidebarOpen(false); }
  async function deleteChat(id: string) {
    setChats((current) => { const remaining = current.filter((chat) => chat.id !== id); if (!remaining.length) { const chat = newChat(); setActiveId(chat.id); return [chat]; } if (id === activeId) setActiveId(remaining[0].id); return remaining; });
    if (supabase && user && cloudReady) await supabase.from("ing_chats").delete().eq("id", id).eq("user_id", user.id);
  }
  function addMemory(value: string) { const memory = value.trim(); if (!memory) return; const next = memories.includes(memory) ? memories : [...memories, memory]; setMemories(next); setMemoryInput(""); void syncMemoryList(next); }
  function removeMemory(index: number) { const next = memories.filter((_, i) => i !== index); setMemories(next); void syncMemoryList(next); }
  function clearMemories() { setMemories([]); void syncMemoryList([]); }

  async function submitAuth(event: FormEvent) {
    event.preventDefault(); if (!supabase) return;
    setAuthBusy(true); setAuthMessage("");
    const result = authMode === "signin" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    if (result.error) setAuthMessage(result.error.message);
    else { setAuthMessage(authMode === "signup" ? "Account created! Check your email if confirmation is enabled." : "Signed in!"); if (authMode === "signin") setAuthOpen(false); }
    setAuthBusy(false);
  }
  async function signOut() { if (supabase) await supabase.auth.signOut(); setCloudReady(false); }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault(); const text = input.trim(); if (!text || loading || !activeChat) return;
    const nextMessages = [...activeChat.messages, { role: "user" as const, content: text }];
    const updatedChat = { ...activeChat, messages: nextMessages, title: activeChat.messages.length ? activeChat.title : text.slice(0, 42), updatedAt: Date.now() };
    setChats((current) => current.map((chat) => chat.id === activeChat.id ? updatedChat : chat)); setInput(""); setLoading(true); void syncChat(updatedChat);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: nextMessages, memories }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Something went wrong.");
      const finished = { ...updatedChat, messages: [...nextMessages, { role: "assistant" as const, content: data.text }], updatedAt: Date.now() };
      setChats((current) => current.map((chat) => chat.id === activeChat.id ? finished : chat)); void syncChat(finished);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      const failed = { ...updatedChat, messages: [...nextMessages, { role: "assistant" as const, content: `Sorry — ${message}` }], updatedAt: Date.now() };
      setChats((current) => current.map((chat) => chat.id === activeChat.id ? failed : chat)); void syncChat(failed);
    } finally { setLoading(false); }
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }

  return <main className="app-shell">
    {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="sidebar-head"><div className="brand"><img src={ING_LOGO} alt="Ing" className="brand-logo" /> <span>Ing</span></div><button className="close-sidebar" onClick={() => setSidebarOpen(false)} aria-label="Close">×</button></div>
      <button className="new-chat" onClick={createChat}>＋ New chat</button>
      {supabase ? <button className="account-button" onClick={() => user ? void signOut() : setAuthOpen(true)}>{user ? `☁️ ${user.email}` : "👤 Sign in / create account"}</button> : <div className="cloud-offline">Cloud sync isn't configured yet.</div>}
      <button className="memory-button" onClick={() => setMemoryOpen((open) => !open)}>🧠 Memory <span>{memories.length}</span></button>
      {memoryOpen && <div className="memory-panel"><p>Things Ing remembers. You control them.</p><form onSubmit={(event) => { event.preventDefault(); addMemory(memoryInput); }} className="memory-form"><input value={memoryInput} onChange={(event) => setMemoryInput(event.target.value)} placeholder="Add a memory…" /><button type="submit">+</button></form>{memories.length === 0 ? <div className="empty-memory">No memories yet.</div> : memories.map((memory, index) => <div className="memory-item" key={`${memory}-${index}`}><span>{memory}</span><button onClick={() => removeMemory(index)} aria-label="Delete memory">×</button></div>)}{memories.length > 0 && <button className="clear-memory" onClick={clearMemories}>Clear all memories</button>}</div>}
      <div className="history-label">Your chats {user && cloudReady ? "☁️" : ""}</div>
      <div className="history-list">{[...chats].sort((a, b) => b.updatedAt - a.updatedAt).map((chat) => <div className={`history-item ${chat.id === activeId ? "active" : ""}`} key={chat.id}><button className="history-button" onClick={() => selectChat(chat.id)}>{chat.title}</button><button className="delete-chat" onClick={() => void deleteChat(chat.id)} aria-label={`Delete ${chat.title}`}>×</button></div>)}</div>
      <div className="memory-note">{user && cloudReady ? "☁️ Synced to your account." : "💾 Saved in this browser."}</div>
    </aside>
    <section className="main-panel">
      <header className="topbar"><button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">☰</button><div className="mobile-title">{activeChat?.title || "Ing"}</div><div className="status">AI assistant</div></header>
      <section className="chat">{messages.length === 0 ? <div className="welcome"><img src={ING_LOGO} alt="Ing" className="welcome-logo" /><h1>How can I help?</h1><p>Ask Ing anything. Your chats and memories are here.</p></div> : <div className="messages">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="avatar">{message.role === "user" ? "You" : <img src={ING_LOGO} alt="Ing" className="message-logo" />}</div><div className="bubble">{message.content}</div></div>)}{loading && <div className="message assistant"><div className="avatar"><img src={ING_LOGO} alt="Ing" className="message-logo" /></div><div className="bubble">Thinking…</div></div>}</div>}<form className="composer" onSubmit={sendMessage}><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} placeholder="Message Ing…" rows={1} disabled={loading} /><button className="send" type="submit" disabled={!input.trim() || loading} aria-label="Send">↑</button></form><div className="hint">Enter to send · Shift+Enter for a new line</div></section>
    </section>
    {authOpen && <div className="auth-overlay"><form className="auth-card" onSubmit={submitAuth}><button type="button" className="auth-close" onClick={() => setAuthOpen(false)}>×</button><h2>{authMode === "signin" ? "Welcome back" : "Create your Ing account"}</h2><p>{authMode === "signin" ? "Sign in to sync your chats and memories." : "Your chats and memories will follow you between devices."}</p><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength={6} required /><button className="auth-submit" disabled={authBusy}>{authBusy ? "Working…" : authMode === "signin" ? "Sign in" : "Create account"}</button>{authMessage && <div className="auth-message">{authMessage}</div>}<button type="button" className="auth-switch" onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthMessage(""); }}>{authMode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}</button></form></div>}
  </main>;
}
