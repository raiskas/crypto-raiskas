"use client";

import { useEffect } from "react";

const DEV_SW_RESET_KEY = "crypto-raiskas:dev-sw-reset";

export function DevServiceWorkerReset() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (process.env.NODE_ENV !== "development" && !isLocalhost) return;

    let cancelled = false;

    const resetServiceWorkers = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const hadRegistrations = registrations.length > 0;

        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const cacheKeys = await window.caches.keys();
          await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
        }

        if (!cancelled && hadRegistrations && !window.sessionStorage.getItem(DEV_SW_RESET_KEY)) {
          window.sessionStorage.setItem(DEV_SW_RESET_KEY, "1");
          window.location.reload();
        }
      } catch (error) {
        console.warn("[DevServiceWorkerReset] Falha ao limpar service workers locais:", error);
      }
    };

    resetServiceWorkers();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
