import type * as React from "react";

import { cn } from "@/shared/utils";

type HeadingBlockSize = "sm" | "md" | "lg" | "xl";
type HeadingBlockRoot = "div" | "header";
type HeadingBlockTitle = "div" | "h1" | "h2" | "h3" | "p";

type HeadingBlockProps = {
  as?: HeadingBlockRoot;
  className?: string;
  description?: React.ReactNode;
  descriptionClassName?: string;
  size?: HeadingBlockSize;
  title: React.ReactNode;
  titleAs?: HeadingBlockTitle;
  titleClassName?: string;
};

const rootClassNameBySize: Record<HeadingBlockSize, string> = {
  sm: "space-y-0",
  md: "space-y-0",
  lg: "space-y-1",
  xl: "space-y-1",
};

const titleClassNameBySize: Record<HeadingBlockSize, string> = {
  sm: "font-medium text-sm leading-5 tracking-normal",
  md: "font-semibold text-base leading-6 tracking-tight",
  lg: "font-semibold text-xl leading-7 tracking-tight sm:text-2xl",
  xl: "font-semibold text-2xl leading-8 tracking-tight sm:text-3xl",
};

const descriptionClassNameBySize: Record<HeadingBlockSize, string> = {
  sm: "text-muted-foreground text-sm leading-5",
  md: "text-muted-foreground text-sm leading-6",
  lg: "text-muted-foreground text-sm leading-6 sm:text-[15px]",
  xl: "text-muted-foreground text-sm leading-6 sm:text-[15px]",
};

function HeadingBlock({
  as: Root = "div",
  className,
  description,
  descriptionClassName,
  size = "md",
  title,
  titleAs: Title = "h2",
  titleClassName,
}: HeadingBlockProps) {
  return (
    <Root className={cn(rootClassNameBySize[size], className)}>
      <Title className={cn(titleClassNameBySize[size], titleClassName)}>
        {title}
      </Title>
      {description ? (
        <p
          className={cn(descriptionClassNameBySize[size], descriptionClassName)}
        >
          {description}
        </p>
      ) : null}
    </Root>
  );
}

export { HeadingBlock };
