import type { CSSProperties, ReactNode } from "react";

type EmailLayoutProps = {
  children: ReactNode;
  previewText: string;
  title: string;
};

type EmailButtonProps = {
  children: ReactNode;
  href: string;
};

type EmailTextProps = {
  children: ReactNode;
};

const pageStyle: CSSProperties = {
  margin: 0,
  backgroundColor: "#14120f",
  color: "#f7f4ef",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  padding: "32px 16px",
};

const containerStyle: CSSProperties = {
  margin: "0 auto",
  maxWidth: "560px",
};

const brandStyle: CSSProperties = {
  color: "#56d9bf",
  fontSize: "18px",
  fontWeight: 700,
  letterSpacing: 0,
  marginBottom: "18px",
};

const panelStyle: CSSProperties = {
  backgroundColor: "#1d1a16",
  border: "1px solid #34302a",
  borderRadius: "8px",
  padding: "32px",
};

const titleStyle: CSSProperties = {
  color: "#f7f4ef",
  fontSize: "24px",
  fontWeight: 700,
  letterSpacing: 0,
  lineHeight: "32px",
  margin: "0 0 16px",
};

const textStyle: CSSProperties = {
  color: "#c8c0b6",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const buttonStyle: CSSProperties = {
  backgroundColor: "#56d9bf",
  borderRadius: "6px",
  color: "#101815",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 700,
  lineHeight: "20px",
  margin: "8px 0 20px",
  padding: "12px 18px",
  textDecoration: "none",
};

const footerStyle: CSSProperties = {
  color: "#8f877c",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "18px 0 0",
};

const hiddenPreviewStyle: CSSProperties = {
  color: "transparent",
  display: "none",
  height: 0,
  maxHeight: 0,
  maxWidth: 0,
  opacity: 0,
  overflow: "hidden",
  width: 0,
};

export function EmailLayout({
  children,
  previewText,
  title,
}: EmailLayoutProps) {
  return (
    <html lang="en">
      <body style={pageStyle}>
        <div style={hiddenPreviewStyle}>{previewText}</div>
        <main style={containerStyle}>
          <div style={brandStyle}>Mirage</div>
          <section style={panelStyle}>
            <h1 style={titleStyle}>{title}</h1>
            {children}
          </section>
          <p style={footerStyle}>
            This message was sent by Mirage. If you did not request it, you can
            safely ignore it.
          </p>
        </main>
      </body>
    </html>
  );
}

export function EmailText({ children }: EmailTextProps) {
  return <p style={textStyle}>{children}</p>;
}

export function EmailButton({ children, href }: EmailButtonProps) {
  return (
    <a href={href} style={buttonStyle}>
      {children}
    </a>
  );
}
