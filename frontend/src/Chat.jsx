import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    if (!safeConversationId) {
      return undefined;
    }

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
            if (prev.some((message) => message.id === incomingMessage.id)) {
              return prev;
            }

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

  const sendMessage = async () => {
    const content = newMsg.trim();

    if (!content || !safeConversationId || !user?.id) return;

    setError("");

    const { error: insertError } = await supabase.from("messages").insert([
      {
        content,
        sender_id: user.id,
        conversation_id: safeConversationId,
      },
    ]);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNewMsg("");
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{ padding: 20, color: "white" }}>
      <h1>Chat</h1>

      <button onClick={logout}>Logout</button>

      {!safeConversationId && <p>Select or create a conversation.</p>}
      {loading && <p>Loading messages...</p>}
      {error && <p style={{ color: "tomato" }}>{error}</p>}

      {messages.map((msg) => (
        <p key={msg.id}>
          {msg.content}
          {msg.sender_id === user.id && " (You)"}
        </p>
      ))}

      <input
        value={newMsg}
        onChange={(e) => setNewMsg(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            sendMessage();
          }
        }}
        placeholder="Type..."
        disabled={!safeConversationId}
      />
      <button
        onClick={sendMessage}
        disabled={!newMsg.trim() || !safeConversationId}
      >
        Send
      </button>
    </div>
  );
}
