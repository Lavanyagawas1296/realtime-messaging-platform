import { useState } from "react";
import { supabase } from "./supabase";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      onLogin(data.user);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center" style={{ backgroundColor: "#0b141a" }}>
      <div className="w-full max-w-md px-8 py-12 rounded-lg" style={{ backgroundColor: "#111b21" }}>
        <h2 className="text-3xl font-bold text-white mb-8 text-center">
          WhatsApp Chat
        </h2>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition rounded-lg"
            style={{ backgroundColor: "#222d31", border: "1px solid #3a464c" }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition rounded-lg"
            style={{ backgroundColor: "#222d31", border: "1px solid #3a464c" }}
          />

          <button
            onClick={handleLogin}
            className="w-full text-white font-semibold py-3 px-4 rounded-lg transition mt-6 hover:opacity-90"
            style={{ backgroundColor: "#008069" }}
          >
            Login
          </button>
        </div>

        {error && (
          <div className="mt-6 p-4 rounded text-red-400 text-sm" style={{ backgroundColor: "#3d2621" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}