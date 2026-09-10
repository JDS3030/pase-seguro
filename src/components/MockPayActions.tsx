"use client";

import { useState } from "react";

export function MockPayActions({
  bookingId,
  cancelHref,
}: {
  bookingId: string;
  cancelHref: string;
}) {
  const [loading, setLoading] = useState<"success" | "fail" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(action: "success" | "fail" | "cancel") {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch("/api/mock-pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.code ?? "Error");
      window.location.href = `/reservas/confirmacion?session_id=${data.sessionId}`;
    } catch (e) {
      setError((e as Error).message);
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {error && <div className="alert error">{error}</div>}

      <button
        className="cta"
        onClick={() => handle("success")}
        disabled={busy}
        style={{ background: "var(--ok)" }}
      >
        {loading === "success" ? "Procesando…" : "Pagar ahora"}
      </button>

      <button
        className="cta"
        onClick={() => handle("fail")}
        disabled={busy}
        style={{ background: "var(--danger)", fontSize: ".88rem", padding: "9px 16px" }}
      >
        {loading === "fail" ? "Procesando…" : "Simular fondos insuficientes"}
      </button>

      <a
        href={cancelHref}
        style={{
          textAlign: "center",
          fontSize: ".85rem",
          color: "var(--ink-3)",
          textDecoration: "none",
          marginTop: 4,
          pointerEvents: busy ? "none" : "auto",
          opacity: busy ? 0.5 : 1,
        }}
        onClick={(e) => {
          if (busy) { e.preventDefault(); return; }
          handle("cancel");
        }}
      >
        Cancelar y volver al tour
      </a>
    </div>
  );
}
