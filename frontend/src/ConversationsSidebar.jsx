import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export default function ConversationsSidebar({
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
    let mounted = true;

    const fetchConversations = async () => {
      setLoading(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("conversations")
        .select("id, name, created_at")
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (fetchError) {
        setConversations([]);
        setError(fetchError.message);
      } else {
        const nextConversations = data || [];

        setConversations(nextConversations);

        if (!selectedConversationIdRef.current && nextConversations.length > 0) {
          onSelectConversation(nextConversations[0].id);
        }
      }

      setLoading(false);
    };

    fetchConversations();

    return () => {
      mounted = false;
    };
  }, [onSelectConversation]);

  const createConversation = async () => {
    setCreating(true);
    setError("");

    const { data, error: insertError } = await supabase
      .from("conversations")
      .insert([
        {
          name: `Conversation ${conversations.length + 1}`,
        },
      ])
      .select("id, name, created_at")
      .single();

    if (insertError) {
      setError(insertError.message);
    } else if (data) {
      setConversations((prev) => [data, ...prev]);
      onSelectConversation(data.id);
    }

    setCreating(false);
  };

  return (
    <aside
      style={{
        width: 260,
        padding: 16,
        borderRight: "1px solid #333",
        color: "white",
      }}
    >
      <h2>Conversations</h2>

      <button onClick={createConversation} disabled={creating}>
        {creating ? "Creating..." : "New Conversation"}
      </button>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "tomato" }}>{error}</p>}

      <div style={{ marginTop: 16 }}>
        {conversations.map((conversation, index) => {
          const isActive = conversation.id === selectedConversationId;

          return (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
              style={{
                display: "block",
                width: "100%",
                marginBottom: 8,
                fontWeight: isActive ? "bold" : "normal",
                textAlign: "left",
              }}
            >
              {conversation.name || `Conversation ${index + 1}`}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
