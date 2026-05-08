"use client";

import { useEffect } from "react";

const isLocalhost = () =>
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-2xl font-semibold">Ocorreu um erro inesperado</h2>
      <p className="text-sm text-muted-foreground">
        Tente novamente. Se persistir, recarregue a página.
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
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        Tentar novamente
      </button>
    </div>
  );
}
