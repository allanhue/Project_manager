import { AuthUser } from "../auth/auth";

type ProfilePageProps = {
  user: AuthUser;
};

export default function ProfilePage({ user }: ProfilePageProps) {
  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        <p className="text-sm text-slate-600">Personal and tenant identity details from your authenticated session.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">User Details</h3>
          <dl className="space-y-2 text-sm text-slate-700">
            <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <dt>Name</dt>
              <dd className="font-medium text-slate-900">{user.name}</dd>
            </div>
            <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <dt>Email</dt>
              <dd className="font-medium text-slate-900">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <dt>User ID</dt>
              <dd className="font-medium text-slate-900">{user.id}</dd>
            </div>
          </dl>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Tenant Details</h3>
          <dl className="space-y-2 text-sm text-slate-700">
            <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <dt>Tenant Slug</dt>
              <dd className="font-medium text-slate-900">{user.tenantSlug}</dd>
            </div>
            <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <dt>Tenant Name</dt>
              <dd className="font-medium text-slate-900">{user.tenantName || "Not set in token payload"}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}
