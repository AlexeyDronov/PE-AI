import { Suspense } from "react";
import { LoginView } from "@/features/auth/LoginView";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
