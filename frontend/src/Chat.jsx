import { useEffect, useMemo, useRef, useState } from "react";
import { fetchAuthUsersByIds } from "./authUsers";
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
  const [otherUser, setOtherUser] = useState(null);
  const [presence, setPresence] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!safeConversationId) return undefined;
    let mounted = true;

    const fetchMessages = async () => {
      setLoading(true);
      setError("");
      const { data, error: fetchError } = await supabase
        .from("messages")
        .select("id, content, sender_id, conversation_id, created_at, delivered, seen")
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

    const markMessagesSeen = async () => {
      if (!user?.id) return;
      await supabase.rpc("mark_conversation_seen", {
        target_conversation_id: safeConversationId,
      });
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${safeConversationId}`,
        },
        (payload) => {
          const updatedMessage = payload.new;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === updatedMessage.id ? updatedMessage : message
            )
          );
        }
      )
      .subscribe();

    fetchMessages().then(markMessagesSeen);

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [safeConversationId, user?.id]);

  useEffect(() => {
    if (!safeConversationId || !user?.id) {
      return undefined;
    }

    let mounted = true;

    const fetchOtherUserAndPresence = async () => {
      try {
        const { data: participants, error: participantsError } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", safeConversationId);

        if (participantsError) throw participantsError;

        const otherUserId = (participants || []).find(
          (participant) => participant.user_id !== user.id
        )?.user_id;

        if (!otherUserId) return;

        const usersById = await fetchAuthUsersByIds([otherUserId]);
        const { data: presenceData, error: presenceError } = await supabase
          .from("user_presence")
          .select("user_id, online, last_seen")
          .eq("user_id", otherUserId)
          .maybeSingle();

        if (presenceError) throw presenceError;
        if (!mounted) return;

        setOtherUser(usersById.get(otherUserId) || { id: otherUserId });
        setPresence(presenceData);
      } catch {
        if (!mounted) return;
        setOtherUser(null);
        setPresence(null);
      }
    };

    fetchOtherUserAndPresence();

    return () => {
      mounted = false;
    };
  }, [safeConversationId, user?.id]);

  useEffect(() => {
    if (!otherUser?.id) return undefined;

    const channel = supabase
      .channel(`presence:${otherUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence",
          filter: `user_id=eq.${otherUser.id}`,
        },
        (payload) => {
          setPresence(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [otherUser?.id]);

  useEffect(() => {
    if (!safeConversationId || !user?.id) return;

    supabase.rpc("mark_conversation_seen", {
      target_conversation_id: safeConversationId,
    });
  }, [messages, safeConversationId, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const content = newMsg.trim();
    if (!content || !safeConversationId || !user?.id) return;
    setError("");
    const { error: insertError } = await supabase.from("messages").insert([
      {
        content,
        sender_id: user.id,
        conversation_id: safeConversationId,
        delivered: true,
        seen: false,
      },
    ]);
    if (insertError) { setError(insertError.message); return; }
    setNewMsg("");
  };

  const logout = async () => {
    if (user?.id) {
      await supabase.from("user_presence").upsert(
        {
          user_id: user.id,
          online: false,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }
    await supabase.auth.signOut();
  };

  const initials = user?.email?.[0]?.toUpperCase() || "U";
  const chatInitials =
    otherUser?.email?.[0]?.toUpperCase() || initials;
  const presenceLabel = presence?.online
    ? "Online"
    : presence?.last_seen
      ? `Last seen ${new Date(presence.last_seen).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "Offline";

  return (
    <section className="chat-shell" style={styles.wrapper}>
      {/* Header */}
      <header className="chat-glass-header" style={styles.header}>
        {safeConversationId ? (
          <>
            <div style={styles.headerLeft}>
              <div style={styles.avatar}>{chatInitials}</div>
              <div>
                <p style={styles.headerName}>{otherUser?.email || "Conversation"}</p>
                <p style={styles.headerStatus}>
                  {presence?.online && <span style={styles.onlineDot} />}
                  {presenceLabel}
                </p>
              </div>
            </div>
            <div style={styles.headerActions}>
              <button className="chat-logout-button" onClick={logout} style={styles.logoutBtn}>Logout</button>
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
      <div className="chat-glass-messages" style={styles.messagesArea}>
        {/* Subtle chat bg pattern */}
        <div className="chat-glass-overlay" style={styles.bgPattern} />

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
                    className={`message-bubble ${isOwn ? "message-bubble-own" : "message-bubble-other"}`}
                    style={{
                      ...styles.bubble,
                      backgroundColor: isOwn ? "#3e5fbd" : "#252b36",
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
                          <path d="M11.071.653a.5.5 0 0 0-.707 0L4.5 6.518 2.136 4.153a.5.5 0 1 0-.707.707l2.718 2.718a.5.5 0 0 0 .707 0l6.217-6.218a.5.5 0 0 0 0-.707z" fill={msg.seen ? "#7dd3fc" : "#dbe4ff"}/>
                          {msg.delivered && <path d="M14.071.653a.5.5 0 0 0-.707 0L7.5 6.518l-.854-.854-.707.707 1.207 1.207a.5.5 0 0 0 .707 0L14.07 1.36a.5.5 0 0 0 0-.707z" fill={msg.seen ? "#7dd3fc" : "#dbe4ff"}/>}
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
        <div className="chat-glass-inputbar" style={styles.inputArea}>
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
            className="chat-message-input"
            style={styles.input}
          />
          <button
            onClick={sendMessage}
            disabled={!newMsg.trim()}
            className="chat-send-button"
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
    backgroundColor: "#171b23",
    position: "relative",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 66,
    padding: "0 clamp(18px, 3vw, 30px)",
    backgroundColor: "rgba(31, 36, 48, 0.96)",
    flexShrink: 0,
    borderBottom: "1px solid rgba(203, 213, 225, 0.1)",
    boxShadow: "0 12px 28px rgba(4, 8, 15, 0.16)",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  avatar: {
    width: 40, height: 40,
    borderRadius: "50%",
    backgroundColor: "#596273",
    backgroundImage: "linear-gradient(135deg, #737d90, #3a4352)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#f8fafc", fontWeight: 700, fontSize: 14, flexShrink: 0,
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.24)",
  },
  headerName: { color: "#f7f8fb", fontSize: 15, fontWeight: 650, margin: 0 },
  headerStatus: {
    color: "#aab4c3", fontSize: 12, margin: "3px 0 0",
    display: "flex", alignItems: "center", gap: 4,
  },
  onlineDot: {
    display: "inline-block", width: 7, height: 7,
    borderRadius: "50%", backgroundColor: "#42c383",
    boxShadow: "0 0 0 3px rgba(66, 195, 131, 0.14)",
  },
  headerActions: { display: "flex", alignItems: "center" },
  logoutBtn: {
    background: "rgba(18, 22, 30, 0.5)", border: "1px solid rgba(203, 213, 225, 0.14)",
    color: "#cfd6e2", fontSize: 12, padding: "6px 14px",
    borderRadius: 999, cursor: "pointer", transition: "all 0.16s ease",
  },
  messagesArea: {
    flex: "1 1 auto", minHeight: 0, overflowY: "auto", position: "relative",
    display: "flex", flexDirection: "column",
    padding: "22px clamp(18px, 4vw, 54px) 16px",
    scrollbarWidth: "thin",
    scrollbarColor: "#4a5361 transparent",
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
    color: "#cbd5e1",
  },
  emptyIcon: { opacity: 0.4 },
  emptyTitle: { color: "#f7f8fb", fontSize: 18, fontWeight: 600, margin: 0 },
  emptySubtitle: { color: "#aab4c3", fontSize: 13, margin: 0 },
  loadingWrap: {
    display: "flex", alignItems: "center", justifyContent: "center",
    height: "100%",
  },
  spinner: {
    width: 28, height: 28,
    border: "3px solid #323946",
    borderTopColor: "#7aa2f7",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  errorBox: {
    margin: "8px 0", padding: "10px 14px",
    backgroundColor: "rgba(127, 29, 29, 0.28)", color: "#fecaca",
    border: "1px solid rgba(248, 113, 113, 0.22)",
    borderRadius: 10, fontSize: 13,
  },
  messagesList: { display: "flex", flex: "1 1 auto", flexDirection: "column", gap: 4, position: "relative", zIndex: 1, width: "100%", maxWidth: 820, margin: "0 auto" },
  dateDivider: { display: "flex", justifyContent: "center", margin: "14px 0 12px" },
  datePill: {
    backgroundColor: "rgba(31, 36, 48, 0.78)", color: "#aab4c3",
    border: "1px solid rgba(203, 213, 225, 0.1)",
    fontSize: 11, padding: "5px 12px", borderRadius: 999,
  },
  msgRow: { display: "flex", width: "100%", marginBottom: 4 },
  bubble: {
    maxWidth: "min(66%, 520px)", padding: "9px 13px 7px",
    boxShadow: "0 12px 24px rgba(4, 8, 15, 0.18)",
    border: "1px solid rgba(255, 255, 255, 0.055)",
  },
  bubbleText: { color: "#f8fafc", fontSize: 14, margin: 0, lineHeight: 1.48, wordBreak: "break-word" },
  bubbleMeta: {
    display: "flex", alignItems: "center", justifyContent: "flex-end",
    gap: 2, marginTop: 3,
  },
  bubbleTime: { color: "rgba(232, 236, 243, 0.66)", fontSize: 11 },
  inputArea: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "14px clamp(18px, 3vw, 30px)",
    backgroundColor: "rgba(31, 36, 48, 0.96)",
    borderTop: "1px solid rgba(203, 213, 225, 0.1)",
    position: "sticky",
    bottom: 0,
    zIndex: 2,
    flexShrink: 0,
  },
  input: {
    flex: 1, backgroundColor: "#202631",
    border: "1px solid rgba(203, 213, 225, 0.12)", borderRadius: 999,
    padding: "13px 17px", color: "#f7f8fb",
    fontSize: 14, outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035), 0 10px 24px rgba(4, 8, 15, 0.18)",
    "::placeholder": { color: "#8696a0" },
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: "50%",
    border: "none", display: "flex",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, transition: "background 0.2s ease, transform 0.16s ease, opacity 0.16s ease",
    boxShadow: "0 12px 24px rgba(64, 101, 196, 0.24)",
  },
};
