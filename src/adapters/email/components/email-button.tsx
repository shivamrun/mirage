import type { ReactNode } from "react";

import { Button, Section } from "react-email";

type EmailButtonProps = {
  children: ReactNode;
  href: string;
};

export function EmailButton({ children, href }: EmailButtonProps) {
  return (
    <Section align="left" className="my-7">
      <Button
        href={href}
        className="rounded-md bg-ink px-[18px] py-3 text-[14px] font-medium leading-[20px] text-white no-underline"
      >
        {children}
      </Button>
    </Section>
  );
}
