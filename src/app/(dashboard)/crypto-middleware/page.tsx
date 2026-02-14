"use client";

const INTERNAL_DASHBOARD_URL = "/crypto-middleware/index.html";

export default function CryptoMiddlewarePage() {
  return (
    <div className="w-full h-[calc(100vh-120px)] px-4 py-4">
      <iframe
        title="Crypto Middleware"
        src={INTERNAL_DASHBOARD_URL}
        className="w-full h-full rounded-lg border bg-background"
      />
    </div>
  );
}
