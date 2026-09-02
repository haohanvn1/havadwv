import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/guards";
import { BlueprintNotFoundError } from "@/server/services/blueprintService";
import {
  GenerationBlockedError,
  GenerationInsufficientError,
  generateExamFromBlueprint,
} from "@/server/services/examGenerationService";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoleApi("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const { job, exam } = await generateExamFromBlueprint(id, auth.user.id);
    return NextResponse.json({ jobId: job.id, status: "CONFIRMED", examId: exam.id }, { status: 201 });
  } catch (error) {
    if (error instanceof BlueprintNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof GenerationBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof GenerationInsufficientError) {
      return NextResponse.json(
        {
          error: error.message,
          jobId: error.jobId,
          status: "FAILED",
          ruleResults: error.ruleResults,
        },
        { status: 422 },
      );
    }
    console.error("[POST /api/admin/exam-blueprints/:id/generate]", error);
    return NextResponse.json({ error: "Không thể sinh đề. Vui lòng thử lại." }, { status: 500 });
  }
}
