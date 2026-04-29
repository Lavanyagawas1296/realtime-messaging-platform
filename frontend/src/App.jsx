import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import Login from "./Login";
import Chat from "./Chat";
import ConversationsSidebar from "./ConversationsSidebar";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const userRef = useRef(null);
  const selectConversation = useCallback((conversationId) => {
    setSelectedConversationId(conversationId);
    setIsSidebarOpen(false);
  }, []);

  const updatePresence = useCallback(async (nextUserId, online) => {
    if (!nextUserId) return;
    await supabase.from("user_presence").upsert(
      {
        user_id: nextUserId,
        online,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (!error) {
        const sessionUser = data.session?.user ?? null;
        userRef.current = sessionUser;
        setUser(sessionUser);
        if (sessionUser) {
          updatePresence(sessionUser.id, true);
        }
      }

      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      const previousUser = userRef.current;
      if (event === "SIGNED_OUT" && previousUser?.id) {
        updatePresence(previousUser.id, false);
      }

      if (session?.user) {
        updatePresence(session.user.id, true);
      }

      userRef.current = session?.user ?? null;
      setUser(session?.user ?? null);

      if (!session?.user) {
        setSelectedConversationId(null);
        setIsSidebarOpen(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [updatePresence]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const markOffline = () => {
      updatePresence(user.id, false);
    };
    const markOnline = () => {
      updatePresence(user.id, true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markOnline();
      } else {
        markOffline();
      }
    };

    window.addEventListener("pagehide", markOffline);
    window.addEventListener("beforeunload", markOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", markOffline);
      window.removeEventListener("beforeunload", markOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [updatePresence, user?.id]);

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
    <div className="app-frame flex h-screen w-screen overflow-hidden" style={{ backgroundColor: "#16192a" }}>
      <div className={`app-card ${isSidebarOpen ? "sidebar-open" : ""}`}>
        <button
          className="mobile-sidebar-toggle"
          type="button"
          aria-label={isSidebarOpen ? "Close conversations" : "Open conversations"}
          aria-expanded={isSidebarOpen}
          onClick={() => setIsSidebarOpen((open) => !open)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </svg>
        </button>
        <button
          className="mobile-sidebar-backdrop"
          type="button"
          aria-label="Close conversations"
          onClick={() => setIsSidebarOpen(false)}
        />
        <ConversationsSidebar
          user={user}
          selectedConversationId={selectedConversationId}
          onSelectConversation={selectConversation}
        />
        <main className="chat-main flex h-full min-h-0 flex-1 min-w-0 flex-col">
          <Chat
            key={selectedConversationId || "empty-chat"}
            user={user}
            conversationId={selectedConversationId}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
