import { useState } from "react";
import { supabase } from "./supabase";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      onLogin(data.user);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <div style={styles.logoCircle}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652c1.746.943 3.71 1.444 5.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896 0-3.176-1.24-6.165-3.48-8.45z"/>
            </svg>
          </div>
          <h1 style={styles.appName}>Arham Chat</h1>
          <p style={styles.appTagline}>Simple. Fast. Reliable.</p>
        </div>

        {/* Form */}
        <div style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              style={styles.input}
            />
          </div>

          {error && (
            <div style={styles.errorBox}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef9a9a" style={{ flexShrink: 0 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            style={{
              ...styles.loginBtn,
              opacity: loading || !email || !password ? 0.6 : 1,
              cursor: loading || !email || !password ? "default" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>

        <p style={styles.footer}>Arham Fintech Pvt Ltd · Mumbai</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "flex", alignItems: "center", justifyContent: "center",
    height: "100vh", width: "100vw",
    backgroundColor: "#0b141a",
  },
  card: {
    width: "100%", maxWidth: 400,
    backgroundColor: "#111b21",
    borderRadius: 12,
    padding: "40px 36px 32px",
    boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
    border: "1px solid #1f2c33",
  },
  logoWrap: {
    display: "flex", flexDirection: "column",
    alignItems: "center", marginBottom: 36,
  },
  logoCircle: {
    width: 64, height: 64, borderRadius: "50%",
    backgroundColor: "#00a884",
    display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: 16,
    boxShadow: "0 4px 20px rgba(0,168,132,0.3)",
  },
  appName: {
    color: "#e9edef", fontSize: 22, fontWeight: 700,
    margin: "0 0 6px", letterSpacing: "-0.3px",
  },
  appTagline: { color: "#8696a0", fontSize: 13, margin: 0 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  inputGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { color: "#8696a0", fontSize: 12, fontWeight: 500, letterSpacing: "0.4px" },
  input: {
    backgroundColor: "#2a3942",
    border: "1px solid #3b4a54",
    borderRadius: 8,
    padding: "11px 14px",
    color: "#e9edef",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
    width: "100%",
    boxSizing: "border-box",
  },
  errorBox: {
    display: "flex", alignItems: "center", gap: 8,
    backgroundColor: "#3d2621", color: "#ef9a9a",
    fontSize: 13, padding: "10px 14px", borderRadius: 8,
  },
  loginBtn: {
    backgroundColor: "#00a884",
    color: "white", fontWeight: 600, fontSize: 15,
    border: "none", borderRadius: 8,
    padding: "13px",
    marginTop: 8,
    transition: "opacity 0.2s, transform 0.1s",
    width: "100%",
  },
  footer: { color: "#3b4a54", fontSize: 11, textAlign: "center", marginTop: 28, marginBottom: 0 },
};