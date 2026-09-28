import type { ReactNode } from "react";

import { Text } from "react-email";

type EmailTextProps = {
  children: ReactNode;
  className?: string;
};

export function EmailText({ children, className }: EmailTextProps) {
  return (
    <Text
      className={`m-0 text-[14px] leading-[23px] text-muted ${
        className ?? "mb-5"
      }`}
    >
      {children}
    </Text>
  );
}
