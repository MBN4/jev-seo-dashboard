import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function OptionRow({ id, title, description, checked, onChange, disabled, badge, children }: {
  id: string;
  title: string;
  description: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border p-4 transition-colors", checked ? "border-brand/30 bg-brand-soft/30" : "bg-card")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor={id} className="text-sm font-medium">{title}</Label>
            {badge}
          </div>
          <div id={`${id}-desc`} className="text-xs text-muted-foreground">{description}</div>
        </div>
        <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} aria-describedby={`${id}-desc`} />
      </div>
      {checked && children && <div className="mt-3 border-t pt-3">{children}</div>}
    </div>
  );
}
