import { Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { ConfirmationView } from "../components/ConfirmationView";

export function ConfirmationPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  if (!sessionId) return (
    <div className="confirm">
      <h1>Falta la referencia del pago</h1>
      <p className="muted">
        Llegaste aquí sin identificador de sesión. Si acabas de pagar, revisa tu correo —
        Stripe te envió el recibo. <a href="/">Volver al catálogo</a>
      </p>
    </div>
  );

  return (
    <Suspense fallback={<div className="confirm">Cargando…</div>}>
      <ConfirmationView sessionId={sessionId} />
    </Suspense>
  );
}
