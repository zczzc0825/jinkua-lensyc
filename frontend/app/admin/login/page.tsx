"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("用户名或密码错误");
      return;
    }

    const data = await response.json();
    localStorage.setItem("plynook_token", data.access_token);
    router.push("/admin/dashboard");
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <header className="login-card-head">
          <span>Secure workspace</span>
          <h1>欢迎回来</h1>
          <p>登录后管理商品、内容和询价数据。</p>
        </header>
        <input
          className="field"
          value={username}
          onChange={event => setUsername(event.target.value)}
          placeholder="管理员账号"
          autoComplete="username"
          required
        />
        <input
          className="field"
          value={password}
          onChange={event => setPassword(event.target.value)}
          type="password"
          placeholder="管理员密码"
          autoComplete="current-password"
          required
        />
        {error && <div className="error">{error}</div>}
        <button className="btn btn-accent" disabled={loading}>
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
    </main>
  );
}
