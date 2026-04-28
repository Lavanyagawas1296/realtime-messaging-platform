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
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ backgroundColor: "#16192a" }}>
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ backgroundColor: "#16192a" }}>
      <ConversationsSidebar
        user={user}
        selectedConversationId={selectedConversationId}
        onSelectConversation={selectConversation}
      />
      <main className="flex h-full min-h-0 flex-1 min-w-0 flex-col">
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
