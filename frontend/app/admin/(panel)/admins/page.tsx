"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminFetch } from "@/lib/api";
import { Plus, Save, X } from "lucide-react";

type Admin = {
  id: number;
  username: string;
  nickname: string;
  role: string;
  is_active: boolean;
  created_at?: string;
};

export default function Admins() {
  const [items, setItems] = useState<Admin[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", nickname: "" });
  const [error, setError] = useState("");

  const load = () => adminFetch<Admin[]>("/api/admin/users").then(setItems).catch(err => setError(err.message || "没有权限"));
  useEffect(() => { load(); }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await adminFetch("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
      setForm({ username: "", password: "", nickname: "" });
      setCreating(false);
      load();
    } catch (err: any) {
      setError(err.message || "添加失败");
    }
  }

  async function setStatus(item: Admin, isActive: boolean) {
    const action = isActive ? "启用" : "禁用";
    if (!confirm(`确定要${action}管理员「${item.nickname || item.username}」吗？`)) return;
    setError("");
    try {
      await adminFetch(`/api/admin/users/${item.id}/status`, { method: "PUT", body: JSON.stringify({ is_active: isActive }) });
      load();
    } catch (err: any) {
      setError(err.message || `${action}失败`);
    }
  }

  async function remove(item: Admin) {
    if (item.is_active) {
      setError("请先禁用管理员，禁用成功后才可以删除。");
      return;
    }
    if (!confirm(`确定永久删除管理员「${item.nickname || item.username}」吗？`)) return;
    setError("");
    try {
      await adminFetch(`/api/admin/users/${item.id}`, { method: "DELETE" });
      load();
    } catch (err: any) {
      setError(err.message || "删除失败");
    }
  }

  return (
    <AdminShell title="管理员管理" actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} />添加管理员</button>}>
      {creating && (
        <div className="panel">
          <div className="admin-header">
            <div>
              <h2>添加普通管理员</h2>
              <p className="muted">只需要填写账号和初始密码，昵称默认等于账号，管理员后续可自己修改。</p>
            </div>
            <button className="btn btn-soft" onClick={() => setCreating(false)}><X size={16} /></button>
          </div>
          <form className="form-grid" onSubmit={create}>
            <label>管理员账号<input className="field" required value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} placeholder="例如 user@example.com" /></label>
            <label>初始密码<input className="field" required type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="至少 8 位" /></label>
            <label>昵称（可选）<input className="field" value={form.nickname} onChange={event => setForm({ ...form, nickname: event.target.value })} placeholder="留空则默认使用账号" /></label>
            {error && <div className="error wide">{error}</div>}
            <button className="btn btn-accent"><Save size={16} />保存管理员</button>
          </form>
        </div>
      )}

      <div className="panel">
        {error && !creating && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
        <table className="table">
          <thead>
            <tr><th>账号</th><th>昵称</th><th>身份</th><th>状态</th><th>创建时间</th><th>操作</th></tr>
          </thead>
          <tbody>
            {items.map(item => {
              const isSuper = item.role === "super_admin";
              return (
                <tr key={item.id}>
                  <td>{item.username}</td>
                  <td>{item.nickname || item.username}</td>
                  <td>{isSuper ? "超级管理员" : "管理员"}</td>
                  <td><span className={`status ${item.is_active ? "" : "status-muted"}`}>{item.is_active ? "正常" : "禁用"}</span></td>
                  <td>{item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</td>
                  <td>
                    {isSuper ? <span className="muted">受保护</span> : (
                      <div className="admin-actions-inline">
                        {item.is_active
                          ? <button className="btn btn-soft" onClick={() => setStatus(item, false)}>禁用</button>
                          : <button className="btn btn-soft" onClick={() => setStatus(item, true)}>恢复正常</button>}
                        {!item.is_active && <button className="danger" onClick={() => remove(item)}>删除</button>}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
