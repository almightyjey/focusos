"use client";

import { PlusIcon } from "lucide-react";

import { SubjectFormDialog } from "@/components/subjects/subject-form-dialog";
import { Button } from "@/components/ui/button";

export function NewSubjectButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  return (
    <SubjectFormDialog
      trigger={
        <Button variant={variant}>
          <PlusIcon aria-hidden /> Nueva materia
        </Button>
      }
    />
  );
}
