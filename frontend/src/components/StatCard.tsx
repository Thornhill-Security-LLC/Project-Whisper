interface StatCardProps {
  label: string;
  value: string;
  trend?: string;
}

export function StatCard({ label, value, trend }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <div className="mt-3 flex items-end justify-between">
        <p className="text-3xl font-semibold text-slate-900">{value}</p>
        {trend ? (
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600">
            {trend}
          </span>
        ) : null}
      </div>
    </div>
  );
}
