import { NavLink } from "react-router-dom";

const navItems = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Risks", to: "/risks" },
  { label: "Controls", to: "/controls" },
  { label: "Vendors", to: "/vendors" },
  { label: "Incidents", to: "/incidents" },
  { label: "Assets", to: "/assets" },
  { label: "Documents", to: "/documents" },
  { label: "Tasks", to: "/tasks" },
  { label: "Access & RBAC Log", to: "/access" },
  { label: "Admin Orgs", to: "/admin/orgs" },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-800 bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mb-10 flex items-center gap-2 text-lg font-semibold text-slate-100">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white">
          PW
        </div>
        Project Whisper
      </div>
      <nav className="flex flex-1 flex-col gap-1 text-sm text-slate-400">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 transition hover:bg-slate-900 ${
                isActive ? "bg-slate-900 text-slate-100" : "text-slate-400"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs text-slate-400">
        <p className="font-medium text-slate-200">Beta workspace</p>
        <p>UI skeleton from UXpilot references.</p>
      </div>
    </aside>
  );
}
