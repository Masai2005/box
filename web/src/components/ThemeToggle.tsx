import { useRef } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui";
import { useTheme, type Theme } from "@/components/ThemeProvider";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const ref = useRef<HTMLDetailsElement>(null);

  return (
    <details ref={ref} className="relative">
      <summary
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center border border-input text-muted-foreground transition-colors hover:border-accent hover:text-accent [&::-webkit-details-marker]:hidden"
        aria-label="Toggle theme"
      >
        {resolvedTheme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-40 border border-border bg-card p-1 shadow-lg">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <Button
              key={option.value}
              variant="ghost"
              size="sm"
              className={`w-full justify-start ${
                theme === option.value ? "bg-accent/10 text-accent" : ""
              }`}
              onClick={() => {
                setTheme(option.value);
                ref.current?.removeAttribute("open");
              }}
            >
              <Icon />
              {option.label}
            </Button>
          );
        })}
      </div>
    </details>
  );
}
