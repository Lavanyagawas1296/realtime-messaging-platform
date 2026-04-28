import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import Login from "./Login";
import Chat from "./Chat";
import ConversationsSidebar from "./ConversationsSidebar";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const selectConversation = useCallback((conversationId) => {
    setSelectedConversationId(conversationId);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (!error) {
        setUser(data.session?.user ?? null);
      }

      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);

      if (!session?.user) {
        setSelectedConversationId(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <ConversationsSidebar
        selectedConversationId={selectedConversationId}
        onSelectConversation={selectConversation}
      />
      <main style={{ flex: 1 }}>
        <Chat
          key={selectedConversationId || "empty-chat"}
          user={user}
          conversationId={selectedConversationId}
        />
      </main>
    </div>
  );
}

export default App;
