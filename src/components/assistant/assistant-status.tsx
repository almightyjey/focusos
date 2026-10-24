"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { AssistantStatus } from "@/integrations/ai/types";

const AssistantStatusContext = createContext<AssistantStatus>({ enabled: false, reason: "" });

/** Comparte con la interfaz si hay asistente de IA. Solo el estado: las claves no salen del servidor. */
export function AssistantStatusProvider({ status, children }: { status: AssistantStatus; children: ReactNode }) {
  return <AssistantStatusContext.Provider value={status}>{children}</AssistantStatusContext.Provider>;
}

export function useAssistantStatus(): AssistantStatus {
  return useContext(AssistantStatusContext);
}
