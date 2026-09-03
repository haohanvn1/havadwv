"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loginAction, type LoginFormState } from "@/lib/auth/actions";

const initialState: LoginFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Đang đăng nhập..." : "Đăng nhập"}
    </Button>
  );
}

export function LoginForm({ from }: { from?: string }) {
  const [state, formAction] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Đăng nhập</CardTitle>
        <CardDescription>Nền tảng ôn luyện ĐGNL / ĐGTD</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {from ? <input type="hidden" name="from" value={from} /> : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="identifier">Tên đăng nhập hoặc email</Label>
            <Input id="identifier" name="identifier" type="text" autoComplete="username" required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center px-2.5"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
