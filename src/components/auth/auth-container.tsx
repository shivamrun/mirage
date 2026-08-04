import type React from "react";

const AuthContainer = ({ authForm }: { authForm: React.ReactNode }) => {
  return (
    <div className="h-screen overflow-hidden flex items-center justify-center flex-col">
      <div className="gap-x-2 flex items-center">
        <img src="/logo.svg" alt="grove logo" className="size-14" />
        <span className="sr-only">Grove</span>
      </div>
      <div className="min-h-0 flex items-center justify-center max-w-md w-full">
        {authForm}
      </div>
    </div>
  );
};

export default AuthContainer;
