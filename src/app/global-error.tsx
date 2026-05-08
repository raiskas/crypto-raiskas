"use client";

const isLocalhost = () =>
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);

  return (
    <html lang="pt-BR">
      <body>
        <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
          <h2 className="text-2xl font-semibold">Falha crítica da aplicação</h2>
          <p className="text-sm text-muted-foreground">
            Tente novamente para recarregar a aplicação.
          </p>
          {isLocalhost() && (
            <pre className="max-w-full overflow-auto rounded-md border bg-muted p-3 text-left text-xs text-foreground">
              {error.message}
              {error.digest ? `\nDigest: ${error.digest}` : ""}
            </pre>
          )}
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-black px-4 py-2 text-sm text-white"
          >
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
