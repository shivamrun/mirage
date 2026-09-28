import type { ReactNode } from "react";

import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email";

import { EmailFooter } from "./email-footer";
import { emailTailwindConfig } from "./theme";

type EmailLayoutProps = {
  children: ReactNode;
  previewText: string;
  title: string;
  description?: ReactNode;
  appUrl?: string;
};

export function EmailLayout({
  children,
  previewText,
  title,
  description,
  appUrl,
}: EmailLayoutProps) {
  return (
    <Tailwind config={emailTailwindConfig}>
      <Html>
        <Head />

        <Body className="m-0 bg-page p-0 font-sans">
          <Preview>{previewText}</Preview>

          <Container className="mx-auto my-0 max-w-[600px] bg-white">
            <Section className="bg-ink px-10 pb-11 pt-8">
              {appUrl ? (
                <Link
                  href={appUrl}
                  className="text-[16px] font-semibold leading-[24px] text-white no-underline"
                >
                  Mirage
                </Link>
              ) : (
                <Text className="m-0 text-[16px] font-semibold leading-[24px] text-white">
                  Mirage
                </Text>
              )}

              <Section align="left" className="mt-6 max-w-[470px]">
                <Text className="m-0 text-[24px] font-semibold leading-[42px] tracking-[-1.3px] text-white">
                  {title}
                </Text>

                {description ? (
                  <Text className="m-0 mt-1 max-w-[450px] text-[14px] leading-[24px] text-hero-muted">
                    {description}
                  </Text>
                ) : null}
              </Section>
            </Section>

            <Section className="bg-white px-10 py-10">
              <Section align="left" className="max-w-[470px]">
                {children}
              </Section>
            </Section>

            <EmailFooter />
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}
