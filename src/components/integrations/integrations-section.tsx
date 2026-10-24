"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { FormAlert } from "@/components/auth/form-alert";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { NotionImportDialog, type NotionDialogData } from "@/components/integrations/notion-import-dialog";
import type { SubjectOption } from "@/components/tasks/task-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AssistantStatus } from "@/integrations/ai/types";
import {
  disconnectNotionAction,
  getNotionSourceAction,
  importNotionAction,
  listNotionSourcesAction,
} from "@/server/actions/integrations";
import type { NotionImportResult, NotionOverview } from "@/server/services/integrations";

export type IntegrationNotice = { tone: "error" | "info"; message: string } | null;

function Panel({
  title,
  status,
  children,
  testId,
}: {
  title: string;
  status: ReactNode;
  children: ReactNode;
  testId: string;
}) {
  return (
    <section className="rounded-xl border p-4 sm:p-5" data-testid={testId} aria-label={title}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        {status}
      </div>
      <div className="space-y-3 text-sm">{children}</div>
    </section>
  );
}

function MissingVars({ names }: { names: string[] }) {
  return (
    <p className="text-muted-foreground">
      Falta en el servidor:{" "}
      {names.map((name, index) => (
        <span key={name}>
          {index > 0 ? ", " : null}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{name}</code>
        </span>
      ))}
      . Consulta <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.example</code>.
    </p>
  );
}

function AssistantPanel({ status }: { status: AssistantStatus }) {
  return (
    <Panel
      title="Asistente de IA"
      testId="integration-assistant"
      status={
        status.enabled ? <Badge variant="secondary">Activo</Badge> : <Badge variant="outline">No configurado</Badge>
      }
    >
      {status.enabled ? (
        <>
          <p>
            Proveedor: <span className="font-medium">{status.label}</span>
          </p>
          <p className="text-muted-foreground">
            En el menú de cada tarea aparece «Dividir en pasos». Solo se envía la tarea que elijas, cuando lo pides, y
            nada se guarda sin tu confirmación.
          </p>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">{status.reason}</p>
          <p className="text-muted-foreground">
            Es opcional: el planificador y el resto de FocusOS funcionan sin IA. Las claves viven solo en el servidor.
          </p>
        </>
      )}
    </Panel>
  );
}

function summary(result: NotionImportResult): string {
  const parts = [`${result.created} nuevas`, `${result.updated} actualizadas`, `${result.unchanged} sin cambios`];
  return `Importación terminada: ${parts.join(", ")}.`;
}

function ImportReport({ result }: { result: NotionImportResult }) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3" data-testid="notion-import-result" role="status">
      <p>{summary(result)}</p>
      {result.failed > 0 ? (
        <p className="text-destructive">
          {result.failed} no se pudieron guardar. La importación no está completa; vuelve a intentarlo.
        </p>
      ) : null}
      {result.truncated ? <p>Solo se leyeron las primeras {result.limit} páginas de la base.</p> : null}
      {result.subjectMissing ? <p>La materia elegida ya no existe: las tareas nuevas quedaron sin materia.</p> : null}
      {result.skippedCount > 0 ? (
        <div>
          <p>{result.skippedCount} páginas no se importaron:</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {result.skipped.map((item, index) => (
              <li key={index}>
                {item.title ?? "Sin título"}: {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function NotionPanel({
  notion,
  subjects,
  lastSyncedLabel,
}: {
  notion: NotionOverview;
  subjects: SubjectOption[];
  lastSyncedLabel: string | null;
}) {
  const [dialog, setDialog] = useState<NotionDialogData | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [result, setResult] = useState<NotionImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, startImport] = useTransition();
  const connected = notion.status !== "disconnected";
  const settings = notion.importSettings;

  const openConfig = () =>
    setDialog({
      sources: listNotionSourcesAction(),
      schema: settings ? getNotionSourceAction(settings.dataSourceId) : null,
    });

  const runImport = () =>
    startImport(async () => {
      setImportError(null);
      setResult(null);
      const response = await importNotionAction();
      if (!response.ok) {
        setImportError(response.error);
        return;
      }
      setResult(response.data);
      if (response.data.failed > 0) toast.error("La importación no se completó");
      else toast.success("Importación terminada");
    });

  const status = !notion.configured ? (
    <Badge variant="outline">No configurado</Badge>
  ) : notion.status === "connected" ? (
    <Badge variant="secondary">Conectado</Badge>
  ) : notion.status === "error" ? (
    <Badge variant="destructive">Con error</Badge>
  ) : (
    <Badge variant="outline">Sin conectar</Badge>
  );

  return (
    <Panel title="Notion" status={status} testId="integration-notion">
      <p className="text-muted-foreground">
        Importa tareas desde una base de Notion. Importar dos veces no duplica: actualiza las que ya trajiste. Nunca
        se borra nada en FocusOS ni se escribe en Notion.
      </p>

      {!notion.configured ? <MissingVars names={notion.missing} /> : null}

      {notion.configured && !connected ? (
        <Button asChild>
          <a href="/api/integrations/notion/connect">Conectar con Notion</a>
        </Button>
      ) : null}

      {notion.configured && connected ? (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Espacio</dt>
            <dd>{notion.workspaceName ?? "—"}</dd>
            <dt className="text-muted-foreground">Base</dt>
            <dd>{settings?.dataSourceName ?? "Sin elegir"}</dd>
            <dt className="text-muted-foreground">Última importación</dt>
            <dd>{lastSyncedLabel ?? "Nunca"}</dd>
          </dl>
          {notion.status === "error" && notion.lastError ? <FormAlert>{notion.lastError}</FormAlert> : null}
          {importError ? <FormAlert>{importError}</FormAlert> : null}
          {result ? <ImportReport result={result} /> : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={runImport} disabled={!settings || importing}>
              {importing ? "Importando…" : "Importar ahora"}
            </Button>
            <Button variant="outline" onClick={openConfig} disabled={importing}>
              Configurar importación
            </Button>
            {notion.status === "error" ? (
              <Button variant="outline" asChild>
                <a href="/api/integrations/notion/connect">Reconectar</a>
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setDisconnecting(true)} disabled={importing}>
              Desconectar
            </Button>
          </div>
        </>
      ) : null}

      <NotionImportDialog data={dialog} current={settings} subjects={subjects} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={disconnecting}
        onOpenChange={setDisconnecting}
        title="¿Desconectar Notion?"
        description="FocusOS borrará su acceso a tu Notion. Las tareas que ya importaste se quedan en FocusOS."
        confirmLabel="Desconectar"
        pendingLabel="Desconectando…"
        successMessage="Notion desconectado"
        onConfirm={async () => {
          const response = await disconnectNotionAction();
          if (response.ok && !response.data.revoked) {
            toast.info("Si quieres, quita también la conexión desde Notion (Ajustes → Conexiones).");
          }
          return response;
        }}
      />
    </Panel>
  );
}

export function IntegrationsSection({
  assistant,
  notion,
  problems,
  subjects,
  lastSyncedLabel,
  notice,
}: {
  assistant: AssistantStatus;
  notion: NotionOverview;
  problems: string[];
  subjects: SubjectOption[];
  lastSyncedLabel: string | null;
  notice: IntegrationNotice;
}) {
  return (
    <div className="space-y-4">
      {notice ? <FormAlert tone={notice.tone}>{notice.message}</FormAlert> : null}
      {problems.length > 0 ? (
        <FormAlert>
          Hay variables del servidor con valores no válidos y se ignoraron: {problems.join("; ")}.
        </FormAlert>
      ) : null}
      <AssistantPanel status={assistant} />
      <NotionPanel notion={notion} subjects={subjects} lastSyncedLabel={lastSyncedLabel} />
    </div>
  );
}
