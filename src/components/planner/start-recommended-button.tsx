"use client";

import { PlayIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startTaskSessionAction } from "@/server/actions/sessions";

export function StartRecommendedButton({ taskId, minutes }: { taskId: string; minutes: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startTaskSessionAction(taskId, minutes);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          router.push("/study");
        })
      }
    >
      <PlayIcon aria-hidden /> {pending ? "Empezando…" : `Empezar ${minutes} min`}
    </Button>
  );
}
