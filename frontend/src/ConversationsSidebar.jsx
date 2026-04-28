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
        console.error("Failed to fetch conversations:", fetchError);
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
            };
          })
          .filter(Boolean)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        setConversations(nextConversations);

        if (!selectedConversationIdRef.current && nextConversations.length > 0) {
          onSelectConversation(nextConversations[0].id);
        }
      }

      setLoading(false);
    };

    fetchConversations();

    return () => {
      isMounted = false;
    };
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

      if (conversationError) {
        console.error("Failed to create conversation:", conversationError);
        setError(conversationError.message);
        return;
      }

      const { error: participantError } = await supabase
        .from("conversation_participants")
        .insert({
          conversation_id: conversation.id,
          user_id: user.id,
        });

      if (participantError) {
        console.error("Failed to link conversation participant:", participantError);
        setError(participantError.message);
        return;
      }

      setConversations((prev) => [
        { ...conversation, lastMessage: "No messages yet" },
        ...prev,
      ]);
      onSelectConversation(conversation.id);
    } finally {
      setCreating(false);
    }
  };

  return (
    <aside className="flex h-screen w-[280px] flex-shrink-0 flex-col border-r" style={{ backgroundColor: "#111b21", borderColor: "#262d31" }}>
      {/* Header with Search */}
      <div className="p-4 border-b" style={{ borderColor: "#262d31" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Chats</h2>
          <button
            onClick={createConversation}
            disabled={creating}
            className="p-2 rounded-full transition hover:opacity-80"
            style={{ backgroundColor: "#222d31" }}
            title="New chat"
          >
            <span className="text-white text-lg">+</span>
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <div className="p-6 text-center text-gray-500">Loading conversations...</div>
        )}
        {error && (
          <div className="p-4 m-4 rounded text-red-400 text-sm" style={{ backgroundColor: "#3d2621" }}>
            {error}
          </div>
        )}

        <div className="flex flex-col">
          {conversations.map((conversation) => {
            const isActive = conversation.id === selectedConversationId;
            const initials = "C";
            const avatarBg = "#00695c";

            return (
              <button
                key={conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
                className="w-full text-left px-3 py-3 border-b flex items-center gap-3 transition hover:opacity-80"
                style={{
                  backgroundColor: isActive ? "#0f5550" : "transparent",
                  borderColor: "#262d31",
                }}
              >
                {/* Avatar */}
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-full w-12 h-12 text-white font-bold text-sm"
                  style={{ backgroundColor: avatarBg }}
                >
                  {initials}
                </div>

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate text-sm">
                    Conversation
                  </div>
                  <div className="text-xs text-gray-500 truncate mt-0.5">
                    {conversation.lastMessage}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
