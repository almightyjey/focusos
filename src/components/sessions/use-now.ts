"use client";

import { useSyncExternalStore } from "react";

// Reloj compartido: un solo intervalo para todos los temporizadores visibles.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  now = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(tick, 1000);
    // Los navegadores frenan los intervalos en pestañas ocultas: al volver se actualiza al instante.
    document.addEventListener("visibilitychange", tick);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
      document.removeEventListener("visibilitychange", tick);
    }
  };
}

/**
 * Hora actual en milisegundos, actualizada cada segundo. Durante el render del
 * servidor y la hidratación devuelve `serverNowMs`, así el HTML coincide.
 */
export function useNow(serverNowMs: number): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => serverNowMs,
  );
}
