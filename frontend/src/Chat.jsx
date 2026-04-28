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

  // Auto-scroll to latest message
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
    <section className="flex h-full min-h-0 flex-1 flex-col" style={{ backgroundColor: "#0b141a" }}>
      {/* Header */}
      <header className="flex h-[72px] flex-shrink-0 items-center justify-between border-b px-6 py-4" style={{ borderColor: "#262d31", backgroundColor: "#111b21" }}>
        {safeConversationId ? (
          <>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-full w-10 h-10 text-white font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: "#00695c" }}
            >
              C
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Conversation</h1>
              <p className="text-xs text-gray-500">Active now</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-sm text-gray-400 hover:text-white transition"
          >
              Logout
            </button>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: "#00695c" }}
            >
              C
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Conversation</h1>
              <p className="text-xs text-gray-500">Select a chat</p>
            </div>
          </div>
        )}
      </header>

      {/* Messages Area */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
        {!safeConversationId && (
          <div className="h-full flex items-center justify-center text-gray-500">
            <p className="text-lg">Select a conversation to start chatting</p>
          </div>
        )}

        {loading && safeConversationId && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Loading messages...</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded text-red-400 text-sm" style={{ backgroundColor: "#3d2621" }}>
            {error}
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.sender_id === user.id;
          return (
            <div
              key={msg.id}
              className={`flex w-full ${isOwn ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[60%] rounded-2xl px-4 py-2 ${
                  isOwn
                    ? "rounded-br-sm"
                    : "rounded-bl-sm"
                }`}
                style={{
                  backgroundColor: isOwn ? "#005c4b" : "#262d31",
                  color: "white",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                }}
              >
                <p className="break-words text-sm leading-snug">{msg.content}</p>
                <p
                  className="text-xs mt-1 opacity-70 text-right"
                >
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {safeConversationId && (
        <div className="flex-shrink-0 border-t px-6 py-4" style={{ borderColor: "#262d31", backgroundColor: "#0b141a" }}>
          <div className="flex gap-3 items-center">
            <input
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message..."
              disabled={!safeConversationId}
              className="flex-1 text-white placeholder-gray-600 focus:outline-none transition px-4 py-2.5 rounded-full"
              style={{ backgroundColor: "#262d31" }}
            />
            <button
              onClick={sendMessage}
              disabled={!newMsg.trim() || !safeConversationId}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: !newMsg.trim() || !safeConversationId ? "#262d31" : "#008069" }}
            >
              <span className="text-white text-lg">→</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
