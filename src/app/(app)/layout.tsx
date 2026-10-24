import { AssistantStatusProvider } from "@/components/assistant/assistant-status";
import { AppShell } from "@/components/layout/app-shell";
import { getAssistantStatus } from "@/integrations/ai/registry";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AssistantStatusProvider status={getAssistantStatus()}>
      <AppShell>{children}</AppShell>
    </AssistantStatusProvider>
  );
}
