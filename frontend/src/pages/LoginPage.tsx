export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-white">
            PW
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to access the Project Whisper console.</p>
        </div>
        <form className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="you@company.com"
              type="email"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="••••••••"
              type="password"
            />
          </div>
          <button className="w-full rounded-lg bg-brand-500 py-2 text-sm font-semibold text-white">
            Sign in
          </button>
        </form>
        <div className="mt-6 text-center text-xs text-slate-400">
          Authentication wiring is coming in a follow-up milestone.
        </div>
      </div>
    </div>
  );
}
