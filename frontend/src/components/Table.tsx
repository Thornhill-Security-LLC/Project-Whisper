import { ReactNode } from "react";

interface TableProps {
  columns?: string[];
  headers?: string[];
  rows: ReactNode[][];
  onRowClick?: (rowIndex: number) => void;
  loading?: boolean;
  emptyState?: string;
}

export function Table({
  columns,
  headers,
  rows,
  onRowClick,
  loading = false,
  emptyState,
}: TableProps) {
  const resolvedColumns = columns ?? headers ?? [];

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  if (rows.length === 0 && emptyState) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
        {emptyState}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            {resolvedColumns.map((column) => (
              <th key={column} className="px-4 py-3 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr
              key={`row-${index}`}
              className={`text-slate-600 ${
                onRowClick ? "cursor-pointer hover:bg-slate-50" : ""
              }`}
              onClick={onRowClick ? () => onRowClick(index) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRowClick(index);
                      }
                    }
                  : undefined
              }
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
            >
              {row.map((cell, cellIndex) => (
                <td key={`cell-${index}-${cellIndex}`} className="px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
