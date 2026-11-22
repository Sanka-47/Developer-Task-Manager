import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils/cn";

export interface DistributionItem {
  label: string;
  count: number;
  dotClassName: string;
  indicatorClassName: string;
}

export function DistributionList({
  items,
  total,
}: {
  items: DistributionItem[];
  total: number;
}) {
  return (
    <ul className="space-y-3.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={cn("h-2 w-2 shrink-0 rounded-full", item.dotClassName)}
                aria-hidden="true"
              />
              <span className="truncate text-muted-foreground">
                {item.label}
              </span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {item.count}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({total === 0 ? 0 : Math.round((item.count / total) * 100)}%)
              </span>
            </span>
          </div>
          <Progress
            value={total === 0 ? 0 : (item.count / total) * 100}
            className="mt-1.5 h-1.5"
            indicatorClassName={item.indicatorClassName}
            label={`${item.label}: ${item.count} of ${total}`}
          />
        </li>
      ))}
    </ul>
  );
}
