// Shared look for every page: one set of buttons, inputs, tags and headers.

export const REPO_URL = "https://github.com/akashkuushwahaa/Self-Hosted-AI-Job-Search-Agent";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const buttonVariants = {
  primary: "bg-accent text-accent-foreground hover:bg-accent/85",
  secondary: "border border-border bg-background hover:bg-subtle",
  ghost: "text-muted hover:text-foreground",
};

const buttonSizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm" };

export function buttonClass(variant: keyof typeof buttonVariants = "primary", size: keyof typeof buttonSizes = "md") {
  return `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${focus} ${buttonVariants[variant]} ${buttonSizes[size]}`;
}

export const inputClass = `block w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted transition-[border-color] duration-150 hover:border-muted/50 ${focus}`;

export const labelClass = "mb-1.5 block text-sm font-medium";

export const linkClass = `rounded-sm underline decoration-border underline-offset-4 transition-[text-decoration-color] hover:decoration-foreground ${focus}`;

export const errorClass = "text-sm text-red-600 dark:text-red-400";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-border pb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </header>
  );
}

const tagTones = {
  neutral: "border-border text-muted",
  good: "border-accent/30 bg-accent/10 text-accent",
  bad: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-400",
};

export function Tag({ tone = "neutral", children }: { tone?: keyof typeof tagTones; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${tagTones[tone]}`}>{children}</span>;
}

export function ScoreBadge({ score }: { score: number | null }) {
  const base = "inline-flex h-9 w-11 shrink-0 items-center justify-center rounded-md text-sm font-semibold tabular-nums";
  if (score == null) return <span className={`${base} border border-dashed border-border text-muted`} title="Not scored yet">–</span>;
  const tone =
    score >= 75
      ? "bg-accent text-accent-foreground"
      : score >= 50
        ? "bg-amber-400/20 text-amber-800 dark:text-amber-300"
        : "bg-subtle text-muted";
  return <span className={`${base} ${tone}`}>{score}</span>;
}

export function Muted({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm text-muted ${className}`}>{children}</p>;
}
