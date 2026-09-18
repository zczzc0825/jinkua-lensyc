"use client";

export function AdminShell({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return <>
    <header className="admin-header">
      <div><span>Management</span><h1>{title}</h1></div>
      {actions && <div className="admin-header-actions">{actions}</div>}
    </header>
    {children}
  </>;
}
