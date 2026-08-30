import Image from "next/image";
import type React from "react";

const AuthContainer = ({ authForm }: { authForm: React.ReactNode }) => {
  return (
    <div className="h-screen overflow-hidden flex items-center justify-center flex-col">
      <div className="gap-x-2 flex items-center">
        <Image
          src="/logo.svg"
          alt="Mirage logo"
          width={56}
          height={56}
          className="size-14"
          priority
        />
        <span className="sr-only">Mirage</span>
      </div>
      <div className="min-h-0 flex items-center justify-center max-w-md w-full">
        {authForm}
      </div>
    </div>
  );
};

export default AuthContainer;
