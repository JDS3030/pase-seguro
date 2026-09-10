"use client";

import { useMemo, useState } from "react";

/**
 * Terminal de pago SIMULADA (solo con MOCK_STRIPE=true).
 *
 * Los datos de tarjeta viven únicamente en el estado de este componente: al
 * enviar solo se manda { bookingId, action } a /api/mock-pay. El resultado lo
 * decide el número de tarjeta de prueba, igual que en Stripe test mode.
 */

type Action = "success" | "fail" | "cancel";

const FRONTEND_URL = (process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:5173").replace(/\/$/, "");

const TEST_CARDS: { label: string; number: string; hint: string; action: Action }[] = [
  { label: "Pago aprobado",        number: "4242424242424242", hint: "Visa · 4242", action: "success" },
  { label: "Fondos insuficientes", number: "4000000000009995", hint: "Visa · 9995", action: "fail" },
  { label: "Tarjeta rechazada",    number: "4000000000000002", hint: "Visa · 0002", action: "fail" },
];

const DECLINE_COPY: Record<string, string> = {
  "9995": "Fondos insuficientes. El emisor rechazó el cargo.",
  "0002": "La tarjeta fue rechazada por el emisor.",
};

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

function groupCard(digits: string) {
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function brandOf(digits: string): string | null {
  if (/^4/.test(digits)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "MASTERCARD";
  if (/^3[47]/.test(digits)) return "AMEX";
  if (/^6/.test(digits)) return "DISCOVER";
  return null;
}

/** Algoritmo de Luhn — misma validación que hace cualquier pasarela real. */
function luhnOk(digits: string): boolean {
  if (digits.length < 13) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function expiryValid(mmYY: string): boolean {
  const m = Number(mmYY.slice(0, 2));
  const y = Number(mmYY.slice(2, 4));
  if (!m || m < 1 || m > 12 || mmYY.length < 4) return false;
  const now = new Date();
  const endOfMonth = new Date(2000 + y, m, 0, 23, 59, 59);
  return endOfMonth >= now;
}

export function MockPayActions({
  bookingId,
  customerName,
  customerEmail,
  amountLabel,
  cancelHref,
}: {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  amountLabel: string;
  cancelHref: string;
}) {
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12/29");
  const [cvc, setCvc] = useState("123");
  const [holder, setHolder] = useState(customerName);
  const [country, setCountry] = useState("DO");

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<"idle" | "paying" | "cancelling">("idle");
  const [declined, setDeclined] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const digits = onlyDigits(card);
  const brand = brandOf(digits);
  const cvcLen = brand === "AMEX" ? 4 : 3;

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!luhnOk(digits)) e.card = "Número de tarjeta inválido.";
    if (!expiryValid(onlyDigits(expiry))) e.expiry = "Fecha de vencimiento inválida.";
    if (onlyDigits(cvc).length !== cvcLen) e.cvc = `El CVC son ${cvcLen} dígitos.`;
    if (holder.trim().length < 2) e.holder = "Escribe el nombre de la tarjeta.";
    return e;
  }, [digits, expiry, cvc, cvcLen, holder]);

  const valid = Object.keys(errors).length === 0;
  const busy = phase !== "idle";

  function show(field: string) {
    return touched[field] ? errors[field] : undefined;
  }

  function fill(number: string) {
    setCard(groupCard(number));
    setExpiry("12/29");
    setCvc("123");
    setDeclined(null);
    setTouched({});
  }

  async function send(action: Action) {
    setError(null);
    setPhase(action === "cancel" ? "cancelling" : "paying");
    try {
      const res = await fetch("/api/mock-pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Nunca se envían datos de tarjeta: el backend solo necesita el desenlace.
        body: JSON.stringify({ bookingId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.code ?? "MOCK_PAY_ERROR");
      window.location.href = `${FRONTEND_URL}/reservas/confirmacion?session_id=${data.sessionId}`;
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ card: true, expiry: true, cvc: true, holder: true });
    if (!valid) return;

    const last4 = digits.slice(-4);
    const declineMsg = DECLINE_COPY[last4];

    if (declineMsg) {
      setDeclined(declineMsg);
      await send("fail");
      return;
    }
    setDeclined(null);
    await send("success");
  }

  return (
    <form className="checkout-form" onSubmit={handleSubmit} noValidate>
      <h1 className="checkout-title">Datos de pago</h1>

      <div className="checkout-scenarios">
        <span className="checkout-scenarios-label">Tarjetas de prueba</span>
        <div className="checkout-chips">
          {TEST_CARDS.map((t) => (
            <button
              key={t.number}
              type="button"
              className="chip"
              onClick={() => fill(t.number)}
              disabled={busy}
              title={t.hint}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="ck-email">Correo</label>
        <input id="ck-email" value={customerEmail} readOnly aria-readonly="true" />
      </div>

      <div className="field">
        <label htmlFor="ck-card">Información de la tarjeta</label>
        <div className={`card-input${show("card") ? " has-error" : ""}`}>
          <div className="card-input-row">
            <input
              id="ck-card"
              inputMode="numeric"
              autoComplete="off"
              placeholder="1234 1234 1234 1234"
              value={card}
              maxLength={19}
              onChange={(e) => setCard(groupCard(onlyDigits(e.target.value).slice(0, 16)))}
              onBlur={() => setTouched((t) => ({ ...t, card: true }))}
              disabled={busy}
            />
            <span className={`card-brand${brand ? " is-known" : ""}`}>{brand ?? "TARJETA"}</span>
          </div>
          <div className="card-input-row is-split">
            <input
              id="ck-exp"
              inputMode="numeric"
              autoComplete="off"
              placeholder="MM/AA"
              value={expiry}
              maxLength={5}
              onChange={(e) => {
                const d = onlyDigits(e.target.value).slice(0, 4);
                setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
              }}
              onBlur={() => setTouched((t) => ({ ...t, expiry: true }))}
              disabled={busy}
            />
            <input
              id="ck-cvc"
              inputMode="numeric"
              autoComplete="off"
              placeholder="CVC"
              value={cvc}
              maxLength={cvcLen}
              onChange={(e) => setCvc(onlyDigits(e.target.value).slice(0, cvcLen))}
              onBlur={() => setTouched((t) => ({ ...t, cvc: true }))}
              disabled={busy}
            />
          </div>
        </div>
        {(show("card") || show("expiry") || show("cvc")) && (
          <p className="field-error">{show("card") ?? show("expiry") ?? show("cvc")}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor="ck-holder">Nombre en la tarjeta</label>
        <input
          id="ck-holder"
          value={holder}
          onChange={(e) => setHolder(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, holder: true }))}
          disabled={busy}
          autoComplete="off"
        />
        {show("holder") && <p className="field-error">{show("holder")}</p>}
      </div>

      <div className="field">
        <label htmlFor="ck-country">País o región</label>
        <select
          id="ck-country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          disabled={busy}
        >
          <option value="DO">República Dominicana</option>
          <option value="US">Estados Unidos</option>
          <option value="ES">España</option>
          <option value="MX">México</option>
        </select>
      </div>

      {declined && <div className="alert error">{declined}</div>}
      {error && <div className="alert error">No pudimos procesar la simulación: {error}</div>}

      <button className="cta checkout-pay" type="submit" disabled={busy}>
        {phase === "paying" ? (
          <>
            <span className="spinner" aria-hidden="true" /> Contactando al emisor…
          </>
        ) : (
          `Pagar ${amountLabel}`
        )}
      </button>

      <p className="checkout-note">
        Formulario simulado: nada de lo que escribas aquí se envía al servidor ni a Stripe. En
        producción esta pantalla la sirve Stripe Checkout.
      </p>

      <a
        className="checkout-cancel"
        href={cancelHref}
        aria-disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          if (busy) return;
          send("cancel");
        }}
      >
        {phase === "cancelling" ? "Cancelando…" : "Cancelar y volver al tour"}
      </a>
    </form>
  );
}
