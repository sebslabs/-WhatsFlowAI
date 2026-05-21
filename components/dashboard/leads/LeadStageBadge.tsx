import { cn } from "@/lib/utils";
import type { LeadStage } from "@/types/index";

const STAGE_STYLES: Record<LeadStage, string> = {
  New: "bg-gray-100 text-gray-700",
  Contacted: "bg-indigo-100 text-indigo-700",
  Qualifying: "bg-blue-100 text-blue-700",
  Qualified: "bg-purple-100 text-purple-700",
  Proposal: "bg-cyan-100 text-cyan-700",
  Booked: "bg-green-100 text-green-700",
  Lost: "bg-red-100 text-red-700",
};

interface Props {
  stage: LeadStage;
  className?: string;
}

export function LeadStageBadge({ stage, className }: Props) {
  const norm = stage?.toLowerCase() || "";
  let style = STAGE_STYLES.New;
  if (norm === "contacted") style = STAGE_STYLES.Contacted;
  else if (norm === "qualifying") style = STAGE_STYLES.Qualifying;
  else if (norm === "qualified") style = STAGE_STYLES.Qualified;
  else if (norm === "proposal") style = STAGE_STYLES.Proposal;
  else if (norm === "booked") style = STAGE_STYLES.Booked;
  else if (norm === "lost") style = STAGE_STYLES.Lost;

  return (
    <span
      className={cn(
        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
        style,
        className
      )}
    >
      {stage}
    </span>
  );
}
