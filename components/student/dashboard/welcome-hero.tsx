import Link from "next/link";
import { NotebookPen, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";

function firstName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? fullName;
}

/**
 * Điểm chạm đầu tiên trên trang — 2 hành động chính (Ôn tập/Thi thử) nằm
 * ngay đây theo đúng yêu cầu "dễ nhìn thấy ngay trên màn hình đầu tiên",
 * không đợi tới section Quick Actions phía dưới.
 */
export function WelcomeHero({ fullName }: { fullName: string }) {
  return (
    <div className="from-primary relative overflow-hidden rounded-3xl bg-gradient-to-br to-[oklch(0.6_0.18_305)] px-6 py-8 text-white sm:px-8 sm:py-10">
      <div
        aria-hidden="true"
        className="absolute -top-16 -right-10 size-56 rounded-full bg-white/15 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="bg-accent2/50 absolute -right-6 -bottom-14 size-36 rounded-[40%_60%_55%_45%]"
      />

      <div className="relative flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold text-balance sm:text-3xl">
          Chào mừng trở lại, {firstName(fullName)} 👋
        </h1>
        <p className="max-w-md text-sm text-white/90 sm:text-base">
          Bạn muốn tiếp tục hành trình chinh phục kỳ thi hôm nay?
        </p>
      </div>

      <div className="relative mt-5 flex flex-wrap gap-3">
        <Button
          size="lg"
          nativeButton={false}
          className="text-primary rounded-full bg-white font-semibold hover:bg-white/90"
          render={<Link href="/student/exams/practice" />}
        >
          <NotebookPen className="size-4.5" aria-hidden="true" />
          Bắt đầu ôn tập
        </Button>
        <Button
          size="lg"
          variant="outline"
          nativeButton={false}
          className="rounded-full border-white/50 bg-white/10 font-semibold text-white hover:bg-white/20"
          render={<Link href="/student/exams/mock" />}
        >
          <Timer className="size-4.5" aria-hidden="true" />
          Thi thử ngay
        </Button>
      </div>
    </div>
  );
}
