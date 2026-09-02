import { requireAuth } from "@/lib/auth/guards";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const user = await requireAuth();

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <ChangePasswordForm forced={user.mustChangePassword} />
    </main>
  );
}
