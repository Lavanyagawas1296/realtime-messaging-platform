import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";

export default function Chat({ user, conversationId }) {
  const safeConversationId = useMemo(
    () => String(conversationId || "").trim(),
    [conversationId]
  );

  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!safeConversationId) return undefined;
    let mounted = true;

    const fetchMessages = async () => {
      setLoading(true);
      setError("");
      const { data, error: fetchError } = await supabase
        .from("messages")
        .select("id, content, sender_id, conversation_id, created_at")
        .eq("conversation_id", safeConversationId)
        .order("created_at", { ascending: true });

      if (!mounted) return;
      if (fetchError) {
        setMessages([]);
        setError(fetchError.message);
      } else {
        setMessages(data || []);
      }
      setLoading(false);
    };

    const channel = supabase
      .channel(`messages:${safeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${safeConversationId}`,
        },
        (payload) => {
          const incomingMessage = payload.new;
          setMessages((prev) => {
            if (!incomingMessage?.id) return prev;
            if (prev.some((m) => m.id === incomingMessage.id)) return prev;
            return [...prev, incomingMessage].sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at)
            );
          });
        }
      )
      .subscribe();

    fetchMessages();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [safeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const content = newMsg.trim();
    if (!content || !safeConversationId || !user?.id) return;
    setError("");
    const { error: insertError } = await supabase.from("messages").insert([
      { content, sender_id: user.id, conversation_id: safeConversationId },
    ]);
    if (insertError) { setError(insertError.message); return; }
    setNewMsg("");
  };

  const logout = async () => { await supabase.auth.signOut(); };

  const initials = user?.email?.[0]?.toUpperCase() || "U";

  return (
    <section style={styles.wrapper}>
      {/* Header */}
      <header style={styles.header}>
        {safeConversationId ? (
          <>
            <div style={styles.headerLeft}>
              <div style={styles.avatar}>{initials}</div>
              <div>
                <p style={styles.headerName}>Conversation</p>
                <p style={styles.headerStatus}>
                  <span style={styles.onlineDot} />
                  Online
                </p>
              </div>
            </div>
            <div style={styles.headerActions}>
              <button style={styles.iconBtn} title="Video call">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#aebac1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </button>
              <button style={styles.iconBtn} title="Search">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aebac1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
              <button onClick={logout} style={styles.logoutBtn}>Logout</button>
            </div>
          </>
        ) : (
          <div style={styles.headerLeft}>
            <div style={styles.avatar}>{initials}</div>
            <div>
              <p style={styles.headerName}>Arham Chat</p>
              <p style={styles.headerStatus}>Select a conversation</p>
            </div>
          </div>
        )}
      </header>

      {/* Messages */}
      <div style={styles.messagesArea}>
        {/* Subtle chat bg pattern */}
        <div style={styles.bgPattern} />

        {!safeConversationId && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#3b4a54" strokeWidth="1.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <p style={styles.emptyTitle}>Select a conversation</p>
            <p style={styles.emptySubtitle}>Choose from your existing chats on the left</p>
          </div>
        )}

        {loading && safeConversationId && (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
          </div>
        )}

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.messagesList}>
          {messages.map((msg, idx) => {
            const isOwn = msg.sender_id === user.id;
            const prevMsg = messages[idx - 1];
            const showDate =
              !prevMsg ||
              new Date(msg.created_at).toDateString() !==
                new Date(prevMsg.created_at).toDateString();

            return (
              <div key={msg.id}>
                {showDate && (
                  <div style={styles.dateDivider}>
                    <span style={styles.datePill}>
                      {new Date(msg.created_at).toLocaleDateString([], {
                        weekday: "long", month: "short", day: "numeric",
                      })}
                    </span>
                  </div>
                )}
                <div style={{ ...styles.msgRow, justifyContent: isOwn ? "flex-end" : "flex-start" }}>
                  <div
                    style={{
                      ...styles.bubble,
                      backgroundColor: isOwn ? "#4f6ef7" : "#252842",
                      borderRadius: isOwn
                        ? "12px 12px 2px 12px"
                        : "12px 12px 12px 2px",
                    }}
                  >
                    <p style={styles.bubbleText}>{msg.content}</p>
                    <div style={styles.bubbleMeta}>
                      <span style={styles.bubbleTime}>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                      {isOwn && (
                        <svg width="16" height="11" viewBox="0 0 16 11" style={{ marginLeft: 3 }}>
                          <path d="M11.071.653a.5.5 0 0 0-.707 0L4.5 6.518 2.136 4.153a.5.5 0 1 0-.707.707l2.718 2.718a.5.5 0 0 0 .707 0l6.217-6.218a.5.5 0 0 0 0-.707z" fill="#dbe4ff"/>
                          <path d="M14.071.653a.5.5 0 0 0-.707 0L7.5 6.518l-.854-.854-.707.707 1.207 1.207a.5.5 0 0 0 .707 0L14.07 1.36a.5.5 0 0 0 0-.707z" fill="#dbe4ff"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      {safeConversationId && (
        <div style={styles.inputArea}>
          <button style={styles.iconBtn} title="Emoji">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#aebac1" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </button>
          <input
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message"
            style={styles.input}
          />
          <button
            onClick={sendMessage}
            disabled={!newMsg.trim()}
            style={{
              ...styles.sendBtn,
              backgroundColor: newMsg.trim() ? "#4f6ef7" : "#252842",
              cursor: newMsg.trim() ? "pointer" : "default",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: "#16192a",
    position: "relative",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 60,
    padding: "0 16px",
    backgroundColor: "#1e2139",
    flexShrink: 0,
    borderBottom: "1px solid #252842",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  avatar: {
    width: 40, height: 40,
    borderRadius: "50%",
    backgroundColor: "#4f6ef7",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "white", fontWeight: 700, fontSize: 14, flexShrink: 0,
  },
  headerName: { color: "#e9edef", fontSize: 15, fontWeight: 600, margin: 0 },
  headerStatus: {
    color: "#8696a0", fontSize: 12, margin: 0,
    display: "flex", alignItems: "center", gap: 4,
  },
  onlineDot: {
    display: "inline-block", width: 7, height: 7,
    borderRadius: "50%", backgroundColor: "#4f6ef7",
  },
  headerActions: { display: "flex", alignItems: "center", gap: 8 },
  iconBtn: {
    background: "none", border: "none", cursor: "pointer",
    padding: "6px", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.15s",
  },
  logoutBtn: {
    background: "none", border: "1px solid #3b4a54",
    color: "#8696a0", fontSize: 12, padding: "5px 12px",
    borderRadius: 6, cursor: "pointer", transition: "all 0.15s",
  },
  messagesArea: {
    flex: "1 1 auto", minHeight: 0, overflowY: "auto", position: "relative",
    display: "flex", flexDirection: "column",
    padding: "12px 6%",
    scrollbarWidth: "thin",
    scrollbarColor: "#374045 transparent",
  },
  bgPattern: {
    position: "fixed", inset: 0, opacity: 0.03,
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
    pointerEvents: "none", zIndex: 0,
  },
  emptyState: {
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    height: "100%", gap: 12, position: "relative", zIndex: 1,
  },
  emptyIcon: { opacity: 0.4 },
  emptyTitle: { color: "#e9edef", fontSize: 18, fontWeight: 500, margin: 0 },
  emptySubtitle: { color: "#8696a0", fontSize: 13, margin: 0 },
  loadingWrap: {
    display: "flex", alignItems: "center", justifyContent: "center",
    height: "100%",
  },
  spinner: {
    width: 28, height: 28,
    border: "3px solid #2a3942",
    borderTopColor: "#4f6ef7",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  errorBox: {
    margin: "8px 0", padding: "10px 14px",
    backgroundColor: "#3d2621", color: "#ef9a9a",
    borderRadius: 8, fontSize: 13,
  },
  messagesList: { display: "flex", flex: "1 1 auto", flexDirection: "column", gap: 2, position: "relative", zIndex: 1 },
  dateDivider: { display: "flex", justifyContent: "center", margin: "12px 0" },
  datePill: {
    backgroundColor: "#182229", color: "#8696a0",
    fontSize: 11, padding: "4px 12px", borderRadius: 8,
  },
  msgRow: { display: "flex", width: "100%", marginBottom: 2 },
  bubble: {
    maxWidth: "65%", padding: "7px 12px 6px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
  },
  bubbleText: { color: "#e9edef", fontSize: 14, margin: 0, lineHeight: 1.4, wordBreak: "break-word" },
  bubbleMeta: {
    display: "flex", alignItems: "center", justifyContent: "flex-end",
    gap: 2, marginTop: 3,
  },
  bubbleTime: { color: "#8696a0", fontSize: 11 },
  inputArea: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "10px 16px",
    backgroundColor: "#1e2139",
    position: "sticky",
    bottom: 0,
    zIndex: 2,
    flexShrink: 0,
  },
  input: {
    flex: 1, backgroundColor: "#252842",
    border: "none", borderRadius: 8,
    padding: "10px 14px", color: "#e9edef",
    fontSize: 14, outline: "none",
    "::placeholder": { color: "#8696a0" },
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: "50%",
    border: "none", display: "flex",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, transition: "background 0.2s",
  },
};
