"use client";

const LEGACY_DASHBOARD_URL = "http://127.0.0.1:8000";

export default function CryptoMiddlewarePage() {
  return (
    <div className="w-full h-[calc(100vh-120px)] px-4 py-4">
      <iframe
        title="Crypto Middleware (Original)"
        src={LEGACY_DASHBOARD_URL}
        className="w-full h-full rounded-lg border bg-background"
      />
    </div>
  );
}
