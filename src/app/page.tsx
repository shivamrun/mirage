const Page = () => {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-3">
        <p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
          Grove
        </p>
        <h1 className="font-semibold text-4xl tracking-tight sm:text-5xl">
          Your app is ready to grow.
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Next.js, Better Auth, Elysia, Drizzle, and Tailwind are wired together
          for the first real feature.
        </p>
      </div>
    </main>
  );
};

export default Page;
