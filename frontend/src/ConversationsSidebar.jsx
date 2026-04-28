import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export default function ConversationsSidebar({
  user,
  selectedConversationId,
  onSelectConversation,
}) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const selectedConversationIdRef = useRef(selectedConversationId);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    let isMounted = true;

    const fetchConversations = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("conversation_participants")
        .select(
          "conversation_id, conversations(id, created_at, messages(content, created_at))"
        )
        .eq("user_id", user.id);

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
        setConversations([]);
      } else {
        const nextConversations = (data || [])
          .map((item) => {
            const conversation = item.conversations;
            if (!conversation) return null;
            const latestMessage = [...(conversation.messages || [])].sort(
              (a, b) => new Date(b.created_at) - new Date(a.created_at)
            )[0];
            return {
              id: conversation.id,
              created_at: conversation.created_at,
              lastMessage: latestMessage?.content || "No messages yet",
              lastTime: latestMessage?.created_at || conversation.created_at,
            };
          })
          .filter(Boolean)
          .sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

        setConversations(nextConversations);

        if (!selectedConversationIdRef.current && nextConversations.length > 0) {
          onSelectConversation(nextConversations[0].id);
        }
      }
      setLoading(false);
    };

    fetchConversations();
    return () => { isMounted = false; };
  }, [onSelectConversation, user?.id]);

  const createConversation = async () => {
    if (!user?.id) return;
    setCreating(true);
    setError("");
    try {
      const { data: conversation, error: conversationError } = await supabase
        .from("conversations")
        .insert({})
        .select("id, created_at")
        .single();

      if (conversationError) { setError(conversationError.message); return; }

      const { error: participantError } = await supabase
        .from("conversation_participants")
        .insert({ conversation_id: conversation.id, user_id: user.id });

      if (participantError) { setError(participantError.message); return; }

      setConversations((prev) => [
        { ...conversation, lastMessage: "No messages yet", lastTime: conversation.created_at },
        ...prev,
      ]);
      onSelectConversation(conversation.id);
    } finally {
      setCreating(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
  };

  const userInitial = user?.email?.[0]?.toUpperCase() || "U";

  return (
    <aside style={styles.sidebar}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.userAvatar}>{userInitial}</div>
        <div style={styles.topActions}>
          <button
            onClick={createConversation}
            disabled={creating}
            style={styles.iconBtn}
            title="New chat"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#aebac1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Title */}
      <div style={styles.titleRow}>
        <h2 style={styles.title}>Chats</h2>
      </div>

      {/* Search bar */}
      <div style={styles.searchWrap}>
        <div style={styles.searchInner}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            placeholder="Search or start new chat"
            style={styles.searchInput}
            readOnly
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={styles.errorBox}>{error}</div>
      )}

      {/* List */}
      <div style={styles.list}>
        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
          </div>
        ) : conversations.length === 0 ? (
          <div style={styles.emptyWrap}>
            <p style={styles.emptyText}>No conversations yet</p>
            <p style={styles.emptyHint}>Tap + to start a new chat</p>
          </div>
        ) : (
          conversations.map((conv, idx) => {
            const isActive = conv.id === selectedConversationId;
            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                style={{
                  ...styles.convItem,
                  backgroundColor: isActive ? "#4f6ef7" : "transparent",
                }}
              >
                {/* Avatar */}
                <div style={{ ...styles.convAvatar, backgroundColor: avatarColors[idx % avatarColors.length] }}>
                  C
                </div>

                {/* Content */}
                <div style={styles.convContent}>
                  <div style={styles.convTop}>
                    <span style={styles.convName}>Conversation</span>
                    <span style={styles.convTime}>{formatTime(conv.lastTime)}</span>
                  </div>
                  <div style={styles.convBottom}>
                    <span style={styles.convLastMsg}>{conv.lastMessage}</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

const avatarColors = ["#4f6ef7", "#6f7ff7", "#8a6ff7", "#5667c9", "#3f57d8", "#6577f4"];

const styles = {
  sidebar: {
    display: "flex", flexDirection: "column",
    width: 300, flexShrink: 0, height: "100vh",
    backgroundColor: "#1e2139",
    borderRight: "1px solid #252842",
    overflow: "hidden",
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 16px",
    backgroundColor: "#1e2139",
    height: 60, flexShrink: 0,
  },
  userAvatar: {
    width: 40, height: 40, borderRadius: "50%",
    backgroundColor: "#4f6ef7",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  topActions: { display: "flex", gap: 4 },
  iconBtn: {
    background: "none", border: "none", cursor: "pointer",
    padding: 8, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  titleRow: { padding: "14px 16px 4px" },
  title: { color: "#e9edef", fontSize: 18, fontWeight: 700, margin: 0 },
  searchWrap: { padding: "8px 12px 4px" },
  searchInner: {
    display: "flex", alignItems: "center", gap: 10,
    backgroundColor: "#252842", borderRadius: 8,
    padding: "8px 12px",
  },
  searchInput: {
    background: "none", border: "none", outline: "none",
    color: "#8696a0", fontSize: 13, flex: 1, cursor: "default",
  },
  errorBox: {
    margin: "8px 12px", padding: "8px 12px",
    backgroundColor: "#3d2621", color: "#ef9a9a",
    fontSize: 12, borderRadius: 8,
  },
  list: { flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#374045 transparent" },
  loadingWrap: { display: "flex", justifyContent: "center", padding: 24 },
  spinner: {
    width: 24, height: 24,
    border: "3px solid #252842", borderTopColor: "#4f6ef7",
    borderRadius: "50%", animation: "spin 0.8s linear infinite",
  },
  emptyWrap: { padding: "32px 16px", textAlign: "center" },
  emptyText: { color: "#e9edef", fontSize: 14, margin: "0 0 6px" },
  emptyHint: { color: "#8696a0", fontSize: 12, margin: 0 },
  convItem: {
    display: "flex", alignItems: "center", gap: 12,
    width: "100%", padding: "10px 16px",
    border: "none", borderBottom: "1px solid #252842",
    cursor: "pointer", textAlign: "left",
    transition: "background 0.15s",
  },
  convAvatar: {
    width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "white", fontWeight: 700, fontSize: 16,
  },
  convContent: { flex: 1, minWidth: 0 },
  convTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 },
  convName: { color: "#e9edef", fontSize: 15, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  convTime: { color: "#8696a0", fontSize: 11, flexShrink: 0, marginLeft: 8 },
  convBottom: {},
  convLastMsg: { color: "#8696a0", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" },
};
