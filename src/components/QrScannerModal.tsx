import { useEffect, useId, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";

type Props = {
  open: boolean;
  onClose: () => void;
  onResult: (text: string) => void;
};

/** stop() lance une exception synchrone si le scan est déjà arrêté — évite le crash React (écran noir). */
async function safeStopAndClear(scanner: Html5Qrcode) {
  try {
    await scanner.stop();
  } catch {
    /* déjà arrêté ou jamais démarré */
  }
  try {
    scanner.clear();
  } catch {
    /* scan encore actif ou DOM démonté */
  }
}

export function QrScannerModal({ open, onClose, onResult }: Props) {
  useBodyScrollLock(open);
  const uid = useId().replace(/:/g, "");
  const readerId = `pss-qr-${uid}`;
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!open) return;
    const scanner = new Html5Qrcode(readerId);
    let done = false;

    void (async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (done) return;
            done = true;
            void safeStopAndClear(scanner).finally(() => {
              onResultRef.current(decoded);
            });
          },
          undefined,
        );
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      done = true;
      void safeStopAndClear(scanner);
    };
  }, [open, readerId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Scanner QR client"
    >
      <p className="mb-4 text-center text-sm text-white/80">
        Scanne le QR code affiché sur le téléphone du client
      </p>
      <div
        id={readerId}
        className="w-full max-w-[min(100%,320px)] overflow-hidden rounded-xl border border-white/20 bg-black"
      />
      <button
        type="button"
        onClick={onClose}
        className="mt-6 rounded-xl border border-white/20 px-6 py-2 text-sm uppercase tracking-[0.14em] text-white/80 hover:bg-white/5"
      >
        Fermer
      </button>
    </div>
  );
}
