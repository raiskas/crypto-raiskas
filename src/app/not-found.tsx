import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-sm text-muted-foreground">
        O recurso que você tentou acessar não existe mais.
      </p>
      <Link href="/home" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
        Ir para Home
      </Link>
    </div>
  );
}

