"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABELS } from "@/domain/labels";
import { PRIORITY_LEVELS, type PriorityLevel } from "@/domain/types";

export function PrioritySelect({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: PriorityLevel;
  onChange: (value: PriorityLevel) => void;
  invalid?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as PriorityLevel)}>
      <SelectTrigger id={id} aria-invalid={invalid} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {[...PRIORITY_LEVELS].reverse().map((level) => (
          <SelectItem key={level} value={level}>
            {PRIORITY_LABELS[level]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
