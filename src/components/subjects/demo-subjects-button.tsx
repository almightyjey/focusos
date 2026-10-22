"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { loadDemoSubjectsAction } from "@/server/actions/subjects";

export function DemoSubjectsButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await loadDemoSubjectsAction();
          if (!result.ok) {
            toast.error(result.error);
          } else if (result.data.created === 0) {
            toast.info("Ya tenías todas las materias de ejemplo.");
          } else {
            toast.success(`Se añadieron ${result.data.created} materias`);
          }
        })
      }
    >
      {pending ? "Añadiendo…" : `Añadir mis ${count} materias de INTEC`}
    </Button>
  );
}
