import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "ADMIN" ? "/admin/dashboard" : "/student/dashboard");
  }

  const { from } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <LoginForm from={from} />
    </main>
  );
}
