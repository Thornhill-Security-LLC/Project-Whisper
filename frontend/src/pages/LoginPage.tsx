import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiJson, getApiErrorMessage } from "../lib/api";

type BootstrapResponse = {
  organisation: { id: string; name: string };
  admin_user: { id: string; email: string };
};

export function LoginPage() {
  const navigate = useNavigate();
  const { identity, setManualIdentity } = useAuth();
  const [orgName, setOrgName] = useState("Acme Security");
  const [adminEmail, setAdminEmail] = useState("admin@example.com");
  const [adminDisplayName, setAdminDisplayName] = useState("Admin");
  const [manualOrgId, setManualOrgId] = useState("");
  const [manualActorId, setManualActorId] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (identity?.organisationId && identity.userId) {
      navigate("/dashboard", { replace: true });
    }
  }, [identity?.organisationId, identity?.userId, navigate]);

  const handleBootstrap = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiJson<BootstrapResponse>("/api/bootstrap", {
        method: "POST",
        json: {
          organisation_name: orgName,
          admin_email: adminEmail,
          admin_display_name: adminDisplayName,
        },
      });

      setManualIdentity({
        organisationId: response.organisation.id,
        userId: response.admin_user.id,
        email: response.admin_user.email,
        authMode: "dev",
      });
      navigate("/dashboard", { replace: true });
    } catch (bootstrapError) {
      setError(getApiErrorMessage(bootstrapError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSession = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    setManualIdentity({
      organisationId: manualOrgId.trim(),
      userId: manualActorId.trim(),
      email: manualEmail.trim() || null,
      authMode: "dev",
    });
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-3xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-white">
              PW
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Dev bootstrap access</h1>
            <p className="mt-2 text-sm text-slate-500">
              Generate a development organisation and admin user for local testing.
            </p>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleBootstrap}>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Organisation name
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                placeholder="Acme Security"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Admin email
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                placeholder="admin@example.com"
                type="email"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Admin display name
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={adminDisplayName}
                onChange={(event) => setAdminDisplayName(event.target.value)}
                placeholder="Admin"
                required
              />
            </div>
            <button
              className="w-full rounded-lg bg-brand-500 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Bootstrapping..." : "Bootstrap Dev Org"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Set session manually</h2>
            <p className="mt-2 text-sm text-slate-500">
              Use this if you already bootstrapped IDs via scripts or Postman.
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleManualSession}>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Organisation ID
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={manualOrgId}
                onChange={(event) => setManualOrgId(event.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actor user ID
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={manualActorId}
                onChange={(event) => setManualActorId(event.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actor email (optional)
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={manualEmail}
                onChange={(event) => setManualEmail(event.target.value)}
                placeholder="admin@example.com"
                type="email"
              />
            </div>
            <button className="w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-700">
              Set session
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
