import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAuthUsersByIds } from "./authUsers";
import { supabase } from "./supabase";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const unique = (values) => [...new Set(values.filter(Boolean))];

async function findAuthUser(target) {
  const value = target.trim();
  if (!value) return null;

  if (uuidPattern.test(value)) {
    const usersById = await fetchAuthUsersByIds([value]);
    return usersById.get(value) || null;
  }

  const { data, error } = await supabase
    .rpc("find_user_by_email", { target_email: value.toLowerCase() })
    .maybeSingle();

  if (error) throw error;
  return data ? { id: data.id, email: data.email } : null;
}

export default function ConversationsSidebar({
  user,
  selectedConversationId,
  onSelectConversation,
}) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const selectedConversationIdRef = useRef(selectedConversationId);
  const userId = user?.id;

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  const fetchConversations = useCallback(
    async ({ showLoading = true } = {}) => {
      if (!userId) return [];
      if (showLoading) setLoading(true);
      setError("");

      try {
        const { data: ownParticipants, error: ownParticipantsError } =
          await supabase
            .from("conversation_participants")
            .select("conversation_id")
            .eq("user_id", userId);

        if (ownParticipantsError) throw ownParticipantsError;

        const conversationIds = unique(
          (ownParticipants || []).map((item) => item.conversation_id)
        );

        if (conversationIds.length === 0) {
          setConversations([]);
          return [];
        }

        const [
          { data: conversationsData, error: conversationsError },
          { data: participantsData, error: participantsError },
          { data: messagesData, error: messagesError },
        ] = await Promise.all([
          supabase
            .from("conversations")
            .select("id, created_at")
            .in("id", conversationIds),
          supabase
            .from("conversation_participants")
            .select("conversation_id, user_id")
            .in("conversation_id", conversationIds),
          supabase
            .from("messages")
            .select("id, conversation_id, content, created_at")
            .in("conversation_id", conversationIds)
            .order("created_at", { ascending: false }),
        ]);

        if (conversationsError) throw conversationsError;
        if (participantsError) throw participantsError;
        if (messagesError) throw messagesError;

        const participantsByConversation = new Map();
        (participantsData || []).forEach((participant) => {
          const existing =
            participantsByConversation.get(participant.conversation_id) || [];
          existing.push(participant.user_id);
          participantsByConversation.set(participant.conversation_id, existing);
        });

        const latestMessageByConversation = new Map();
        (messagesData || []).forEach((message) => {
          if (!latestMessageByConversation.has(message.conversation_id)) {
            latestMessageByConversation.set(message.conversation_id, message);
          }
        });

        const otherUserIds = unique(
          (participantsData || [])
            .filter((participant) => participant.user_id !== userId)
            .map((participant) => participant.user_id)
        );
        const authUsersById = await fetchAuthUsersByIds(otherUserIds);

        const nextConversations = (conversationsData || [])
          .map((conversation) => {
            const participantIds =
              participantsByConversation.get(conversation.id) || [];
            const otherUserId = participantIds.find(
              (participantId) => participantId !== userId
            );
            const otherUser = authUsersById.get(otherUserId);
            const latestMessage = latestMessageByConversation.get(
              conversation.id
            );

            if (!otherUserId || !otherUser) return null;

            return {
              id: conversation.id,
              created_at: conversation.created_at,
              other_user: otherUser,
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

        return nextConversations;
      } catch (fetchError) {
        setError(fetchError.message);
        setConversations([]);
        return [];
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [onSelectConversation, userId]
  );

  useEffect(() => {
    let isMounted = true;

    Promise.resolve().then(() => fetchConversations()).finally(() => {
      if (!isMounted) return;
    });

    return () => {
      isMounted = false;
    };
  }, [fetchConversations]);

  useEffect(() => {
    if (!userId) return undefined;

    const refreshConversations = () => {
      fetchConversations({ showLoading: false });
    };

    const channel = supabase
      .channel(`conversation-list:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${userId}`,
        },
        refreshConversations
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        refreshConversations
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConversations, userId]);

  const createConversation = async (targetUserInput) => {
    if (!userId) return;
    const target =
      targetUserInput ||
      window.prompt("Enter the user's email address or user id");
    if (!String(target || "").trim()) return;

    setCreating(true);
    setError("");
    try {
      const targetUser = await findAuthUser(String(target));
      if (!targetUser) {
        setError("No user found for that email or id.");
        return;
      }

      if (targetUser.id === userId) {
        setError("Choose another user to start a chat.");
        return;
      }

      const { data: conversation, error: conversationError } = await supabase
        .rpc("get_or_create_private_conversation", {
          target_user_id: targetUser.id,
        })
        .single();

      if (conversationError) throw conversationError;

      await fetchConversations({ showLoading: false });
      onSelectConversation(conversation.id);
    } catch (createError) {
      setError(createError.message);
	console.error("Sidebar error:", createError);
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
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredConversations = normalizedSearch
    ? conversations.filter((conv) =>
        (conv.other_user?.email || "").toLowerCase().includes(normalizedSearch)
      )
    : conversations;

  return (
    <aside className="conversations-sidebar" style={styles.sidebar}>
      {/* Top bar */}
      <div className="sidebar-glass-topbar" style={styles.topBar}>
        <div style={styles.userAvatar}>{userInitial}</div>
        <div style={styles.topActions}>
          <button
            className="sidebar-icon-button"
            onClick={() => createConversation()}
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
        <div className="sidebar-glass-search" style={styles.searchInner}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            placeholder="Search or start new chat"
            style={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
        ) : filteredConversations.length === 0 && normalizedSearch ? (
          <button
            className="start-chat-option"
            onClick={() => createConversation(searchTerm)}
            disabled={creating}
            style={styles.startChatOption}
          >
            Start new chat with "{searchTerm.trim()}"
          </button>
        ) : conversations.length === 0 ? (
          <div style={styles.emptyWrap}>
            <p style={styles.emptyText}>No conversations yet</p>
            <p style={styles.emptyHint}>Tap + to start a new chat</p>
          </div>
        ) : (
          filteredConversations.map((conv, idx) => {
            const isActive = conv.id === selectedConversationId;
            return (
              <button
                key={conv.id}
                className={`conversation-item ${isActive ? "is-active" : ""}`}
                onClick={() => onSelectConversation(conv.id)}
                style={{
                  ...styles.convItem,
                  backgroundColor: isActive ? "rgba(37, 99, 235, 0.18)" : "transparent",
                }}
              >
                {/* Avatar */}
                <div className="conversation-avatar" style={{ ...styles.convAvatar, backgroundColor: avatarColors[idx % avatarColors.length] }}>
                  {(conv.other_user?.email?.[0] || "U").toUpperCase()}
                </div>

                {/* Content */}
                <div style={styles.convContent}>
                  <div style={styles.convTop}>
                    <span style={styles.convName}>
                      {conv.other_user?.email || "Unknown user"}
                    </span>
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
    width: 320, flexShrink: 0, height: "100vh",
    backgroundColor: "#12161f",
    borderRight: "1px solid rgba(203, 213, 225, 0.1)",
    overflow: "hidden",
    boxShadow: "10px 0 34px rgba(4, 8, 15, 0.24)",
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 18px",
    backgroundColor: "#181d28",
    minHeight: 66, flexShrink: 0,
    borderBottom: "1px solid rgba(203, 213, 225, 0.08)",
  },
  userAvatar: {
    width: 40, height: 40, borderRadius: "50%",
    backgroundColor: "#596273",
    backgroundImage: "linear-gradient(135deg, #737d90, #3a4352)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#f8fafc", fontWeight: 700, fontSize: 14, cursor: "pointer",
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.24)",
  },
  topActions: { display: "flex", gap: 4 },
  iconBtn: {
    background: "transparent", border: "none", cursor: "pointer",
    padding: 8, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.16s ease, transform 0.16s ease",
  },
  titleRow: { padding: "18px 18px 9px" },
  title: { color: "#f7f8fb", fontSize: 20, fontWeight: 700, margin: 0 },
  searchWrap: { padding: "6px 14px 12px" },
  searchInner: {
    display: "flex", alignItems: "center", gap: 10,
    backgroundColor: "#202631", borderRadius: 999,
    border: "1px solid rgba(203, 213, 225, 0.1)",
    padding: "10px 14px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035), 0 10px 22px rgba(4, 8, 15, 0.12)",
  },
  searchInput: {
    background: "none", border: "none", outline: "none",
    color: "#aab4c3", fontSize: 13, flex: 1, cursor: "text",
  },
  errorBox: {
    margin: "8px 14px", padding: "9px 12px",
    backgroundColor: "rgba(127, 29, 29, 0.28)", color: "#fecaca",
    border: "1px solid rgba(248, 113, 113, 0.22)",
    fontSize: 12, borderRadius: 10,
  },
  list: { flex: 1, overflowY: "auto", padding: "6px 10px 14px", scrollbarWidth: "thin", scrollbarColor: "#4a5361 transparent" },
  loadingWrap: { display: "flex", justifyContent: "center", padding: 24 },
  spinner: {
    width: 24, height: 24,
    border: "3px solid #323946", borderTopColor: "#7aa2f7",
    borderRadius: "50%", animation: "spin 0.8s linear infinite",
  },
  emptyWrap: { padding: "32px 16px", textAlign: "center" },
  emptyText: { color: "#f7f8fb", fontSize: 14, margin: "0 0 6px" },
  emptyHint: { color: "#aab4c3", fontSize: 12, margin: 0 },
  startChatOption: {
    width: "100%",
    padding: "12px",
    border: "1px solid rgba(122, 162, 247, 0.24)",
    borderRadius: 12,
    background: "rgba(122, 162, 247, 0.1)",
    color: "#dbe6ff",
    cursor: "pointer",
    textAlign: "left",
    fontSize: 13,
  },
  convItem: {
    display: "flex", alignItems: "center", gap: 12,
    width: "100%", padding: "11px 12px",
    marginBottom: 4,
    border: "1px solid transparent",
    borderRadius: 12,
    cursor: "pointer", textAlign: "left",
    transition: "background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease",
  },
  convAvatar: {
    width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#f8fafc", fontWeight: 700, fontSize: 15,
    boxShadow: "0 8px 18px rgba(4, 8, 15, 0.24)",
  },
  convContent: { flex: 1, minWidth: 0 },
  convTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 },
  convName: { color: "#f7f8fb", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  convTime: { color: "#aab4c3", fontSize: 11, flexShrink: 0, marginLeft: 8 },
  convBottom: {},
  convLastMsg: { color: "#aab4c3", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" },
};


