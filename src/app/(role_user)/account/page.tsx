import { redirect } from "next/navigation";

type AccountRoutePageProps = {
  searchParams: Promise<{
    emailChange?: string;
    googleAccount?: string;
  }>;
};

export default async function Page({ searchParams }: AccountRoutePageProps) {
  const { emailChange, googleAccount } = await searchParams;
  const params = new URLSearchParams();

  if (googleAccount) {
    params.set("googleAccount", googleAccount);
    redirect(`/account/security?${params}`);
  }

  if (emailChange) {
    params.set("emailChange", emailChange);
    redirect(`/account/profile?${params}`);
  }

  redirect("/account/profile");
}
