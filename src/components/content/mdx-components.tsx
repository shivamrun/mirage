import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

const mdxComponents = {
  a: ({ href = "", ...props }: ComponentPropsWithoutRef<"a">) => {
    if (href.startsWith("/")) {
      return <Link className="link-text" href={href} {...props} />;
    }

    return (
      <a
        className="link-text"
        href={href}
        rel="noreferrer"
        target={href.startsWith("#") ? undefined : "_blank"}
        {...props}
      />
    );
  },
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2 className="scroll-m-20 border-border border-t pt-8" {...props} />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3 className="scroll-m-20" {...props} />
  ),
  hr: (props: ComponentPropsWithoutRef<"hr">) => (
    <hr className="border-border" {...props} />
  ),
} satisfies MDXComponents;

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...mdxComponents,
    ...components,
  };
}
