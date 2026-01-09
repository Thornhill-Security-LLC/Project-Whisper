interface ModalProps {
  title: string;
  description: string;
  open?: boolean;
}

export function Modal({ title, description, open = false }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
            Close
          </button>
          <button className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm text-white">Save</button>
        </div>
      </div>
    </div>
  );
}
