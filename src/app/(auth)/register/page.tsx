import { BadgeCheck, BookOpen, PenTool } from "lucide-react";
import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth";
import { getSafeAuthRedirect } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Create Account | Grove",
};

type RegisterPageProps = {
  searchParams: Promise<{
    callbackURL?: string;
  }>;
};

const features = [
  {
    icon: PenTool,
    label: (
      <>
        Selected creators
        <br />
        publish original comics
      </>
    ),
  },
  {
    icon: BadgeCheck,
    label: (
      <>
        Every submission
        <br />
        is editorially reviewed
      </>
    ),
  },
  {
    icon: BookOpen,
    label: (
      <>
        Curated stories
        <br />
        worth discovering
      </>
    ),
  },
];

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const { callbackURL } = await searchParams;

  return (
    <main className="relative grid min-h-screen lg:grid-cols-2">
      <div className="absolute top-8 left-8 z-10 flex items-center gap-3">
        <img src="/logo.svg" alt="Grove logo" className="size-9" />

        <span className="text-2xl font-medium tracking-tight">Grove</span>
      </div>

      <section className="flex min-h-screen items-center justify-center px-6 py-24 lg:px-12">
        <RegisterForm redirectTo={getSafeAuthRedirect(callbackURL)} />
      </section>

      <section className="hidden min-h-screen p-6 lg:block">
        <div className="relative flex h-full min-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-3xl bg-white">
          <div className="flex flex-1 bg-primary/40 flex-col items-center justify-center px-12 pb-32 text-center">
            <img
              src="/logo.svg"
              alt=""
              className="size-20 mb-6 drop-shadow-sm"
            />

            <h1 className="max-w-xl text-5xl leading-[1.05] text-background">
              A curated space for
              <br />
              original comics.
            </h1>

            <p className="mt-6 max-w-md text-neutral-600 leading-relaxed">
              Grove brings together original comics from a carefully chosen
              group of creators.
            </p>
          </div>

          <div className="absolute right-0 bottom-0 left-0 grid grid-cols-3 px-12 pb-14">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={Icon.displayName}
                className="flex flex-col items-center text-center"
              >
                <Icon
                  className="mb-4 size-6 text-neutral-600"
                  strokeWidth={1.8}
                />

                <p className="text-sm leading-5 text-neutral-600">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
