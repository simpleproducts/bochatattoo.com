type SearchParams = { from?: string; error?: string };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { from, error } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form
        action="/api/admin/login"
        method="post"
        className="w-full max-w-sm flex flex-col gap-6"
      >
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Admin
          </span>
          <h1 className="font-serif italic text-4xl">Sign in</h1>
        </div>

        <input type="hidden" name="from" value={from ?? "/admin"} />

        <label className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Password
          </span>
          <input
            type="password"
            name="password"
            autoFocus
            required
            autoComplete="current-password"
            className="bg-transparent border border-line px-3 py-2 text-fg focus:outline-none focus:border-fg"
          />
        </label>

        {error ? (
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-red-400">
            Wrong password.
          </p>
        ) : null}

        <button
          type="submit"
          className="border border-fg px-4 py-2 text-xs uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors"
        >
          Enter
        </button>
      </form>
    </main>
  );
}
