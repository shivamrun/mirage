import { Column, Img, Link, Row, Section, Text } from "react-email";

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

export const emailBaseUrl = baseUrl;

export const emailSocials = [
  {
    label: "X",
    href: "https://x.com/mirage",
    icon: `${baseUrl}/email/x.svg`,
  },
  {
    label: "GitHub",
    href: "https://github.com/mirage",
    icon: `${baseUrl}/email/github.svg`,
  },
  {
    label: "Website",
    href: baseUrl,
    icon: `${baseUrl}/email/globe.svg`,
  },
  {
    label: "Discord",
    href: "https://discord.gg/your-invite",
    icon: `${baseUrl}/email/discord.svg`,
  },
] as const;

export function EmailFooter() {
  return (
    <Section className="bg-footer px-10 py-8">
      <Row style={{ width: "100%" }}>
        <Column align="left" valign="middle">
          <Text className="m-0 text-[16px] font-semibold leading-[24px] text-footer-text">
            Mirage
          </Text>
        </Column>

        <Column align="right" valign="middle">
          <Row
            align="right"
            style={{
              width: "auto",
              marginLeft: "auto",
            }}
          >
            {emailSocials.map((social, index) => (
              <Column
                key={social.label}
                style={{
                  width: "16px",
                  paddingRight:
                    index === emailSocials.length - 1 ? "0" : "14px",
                }}
              >
                <Link
                  href={social.href}
                  aria-label={social.label}
                  className="inline-block no-underline"
                >
                  <Img
                    src={social.icon}
                    alt={social.label}
                    width="14"
                    height="14"
                    className="block"
                  />
                </Link>
              </Column>
            ))}
          </Row>
        </Column>
      </Row>

      <Text className="m-0 mt-4 max-w-[390px] text-[11px] leading-[18px] text-footer-muted">
        This email was sent because of activity on your Mirage account.
      </Text>

      <Text className="m-0 mt-2 text-[10px] leading-[16px] text-footer-muted">
        © {new Date().getFullYear()} Mirage. All rights reserved.
      </Text>
    </Section>
  );
}
