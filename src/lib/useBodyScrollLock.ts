import { useEffect } from "react";

/**
 * Fige le scroll de la page tant qu'une surcouche (modale, lightbox…) est
 * ouverte. On passe le body en `position: fixed` plutôt qu'un simple
 * `overflow: hidden`, seul moyen fiable de bloquer le scroll sur iOS Safari.
 *
 * Le compteur gère les surcouches empilées (une lightbox ouverte au-dessus
 * d'une modale) : seule la première verrouille, seule la dernière restaure.
 */
let lockCount = 0;
let savedScrollY = 0;
let savedStyles: Record<string, string> = {};

const LOCKED: Record<string, string> = {
  position: "fixed",
  left: "0",
  right: "0",
  width: "100%",
  overflow: "hidden",
};

function lockBody() {
  if (lockCount++ > 0) return;
  const body = document.body;
  savedScrollY = window.scrollY;
  savedStyles = {};
  for (const key of [...Object.keys(LOCKED), "top"]) {
    savedStyles[key] = body.style.getPropertyValue(key);
  }
  for (const [key, value] of Object.entries(LOCKED)) {
    body.style.setProperty(key, value);
  }
  body.style.setProperty("top", `-${savedScrollY}px`);
}

function unlockBody() {
  if (lockCount === 0 || --lockCount > 0) return;
  const body = document.body;
  for (const [key, value] of Object.entries(savedStyles)) {
    if (value) body.style.setProperty(key, value);
    else body.style.removeProperty(key);
  }
  window.scrollTo(0, savedScrollY);
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockBody();
    return unlockBody;
  }, [active]);
}
