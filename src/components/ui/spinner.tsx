import { cn } from "cn";
import { Loader2Icon } from "lucide-react";

function Spinner({ className, ...props }: React.ComponentProps<"output">) {
  return (
    <output
      data-slot="spinner"
      aria-label="Loading"
      className={cn(
        "inline-flex size-4 items-center justify-center",
        className,
      )}
      {...props}
    >
      <Loader2Icon aria-hidden="true" className="size-full animate-spin" />
    </output>
  );
}

export { Spinner };
