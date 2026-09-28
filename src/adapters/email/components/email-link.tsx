import type { ReactNode } from "react";

import { Link } from "react-email";

type EmailLinkProps = {
  children: ReactNode;
  href: string;
};

export function EmailLink({ children, href }: EmailLinkProps) {
  return (
    <Link href={href} className="text-[14px] font-medium text-link underline">
      {children}
    </Link>
  );
}
