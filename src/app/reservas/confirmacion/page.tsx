import { Suspense } from "react";
import { ConfirmationView } from "@/components/ConfirmationView";

export const dynamic = "force-dynamic";

export default async function ConfirmacionPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    return (
      <div className="confirm">
        <h1>Falta la referencia del pago</h1>
        <p className="muted">
          Llegaste aquí sin identificador de sesión. Si acabas de pagar, revisa tu correo:
          Stripe te envió el recibo. <a href="/">Volver al catálogo</a>
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="confirm">Cargando…</div>}>
      <ConfirmationView sessionId={sessionId} />
    </Suspense>
  );
}
