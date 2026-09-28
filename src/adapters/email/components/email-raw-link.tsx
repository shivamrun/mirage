import { Link } from "react-email";

type EmailRawLinkProps = {
  href: string;
};

export function EmailRawLink({ href }: EmailRawLinkProps) {
  return (
    <Link
      href={href}
      className="break-all text-[13px] leading-[21px] text-link underline"
    >
      {href}
    </Link>
  );
}
