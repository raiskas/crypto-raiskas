import { cookies, headers } from "next/headers";

const getBaseUrl = () => {
  const headerStore = headers();
  const host = headerStore.get("host");
  const forwardedProto = headerStore.get("x-forwarded-proto");

  if (!host) {
    throw new Error("Host da requisição não encontrado.");
  }

  const protocol = forwardedProto || (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
};

const getCookieHeader = () =>
  cookies()
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

export async function fetchInternalJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    headers: {
      Cookie: getCookieHeader(),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string" &&
        payload.error) ||
      `Falha ao buscar ${path}`;
    throw new Error(message);
  }

  return payload as T;
}
