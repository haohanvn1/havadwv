import "server-only";
import { prisma } from "@/lib/prisma";
import { validateQuestionInput } from "@/validators/question";
import { createQuestion } from "./questionService";
import { readDraftParsedContent, type DraftReviewData } from "./importDraftContent";
import {
  DraftAlreadyApprovedError,
  DraftAlreadyRejectedError,
  DraftNotFoundError,
  DraftValidationError,
} from "./importDraftErrors";
import { findPossibleDuplicateQuestions } from "./questionDuplicateChecker";

export { DraftAlreadyApprovedError, DraftAlreadyRejectedError, DraftNotFoundError, DraftValidationError };

/** Phase 6 luôn tạo đúng 2 option "Đúng"/"Sai" theo thứ tự cố định cho TRUE_FALSE — suy ngược lại trueFalseAnswer từ review.options theo đúng quy ước đó. */
function deriveTrueFalseAnswer(review: DraftReviewData): "TRUE" | "FALSE" | undefined {
  if (review.questionType !== "TRUE_FALSE") return undefined;
  const correct = review.options.find((o) => o.isCorrect);
  if (!correct) return undefined;
  const normalized = correct.text.trim().toLowerCase();
  if (normalized.startsWith("đúng") || normalized === "true" || normalized === "t") return "TRUE";
  if (normalized.startsWith("sai") || normalized === "false" || normalized === "f") return "FALSE";
  return review.options.indexOf(correct) === 0 ? "TRUE" : "FALSE";
}

export async function checkDuplicateForDraft(draftId: string) {
  const draft = await prisma.importQuestionDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw new DraftNotFoundError();
  const content = readDraftParsedContent(draft.parsedContent);
  const questionText = content.review?.questionText || draft.rawText;
  return findPossibleDuplicateQuestions(questionText);
}

/**
 * Approve — bước DUY NHẤT được phép tạo Question thật (mục 40). Transaction
 * bao gồm cả việc tạo Question/QuestionOption (qua questionService.createQuestion
 * — tái sử dụng, không duplicate logic) LẪN cập nhật draft, để không bao giờ
 * tồn tại Question "nửa chừng" nếu một bước lỗi (mục 25).
 *
 * Double-approve an toàn: nếu draft đã APPROVED, trả lại đúng Question đã tạo
 * trước đó thay vì tạo mới (mục 26) — kiểm tra cả trước transaction (đường đi
 * nhanh) lẫn LẠI bên trong transaction (đóng race condition khi bấm 2 lần
 * gần như đồng thời).
 */
export async function approveDraft(draftId: string, approvedById: string) {
  const draft = await prisma.importQuestionDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw new DraftNotFoundError();

  if (draft.status === "APPROVED") {
    if (draft.approvedQuestionId) {
      const existing = await prisma.question.findUnique({
        where: { id: draft.approvedQuestionId },
        include: { options: { orderBy: { order: "asc" } } },
      });
      if (existing) return { question: existing, alreadyApproved: true as const };
    }
    throw new DraftAlreadyApprovedError();
  }
  if (draft.status === "REJECTED") {
    throw new DraftAlreadyRejectedError();
  }

  const content = readDraftParsedContent(draft.parsedContent);
  const review = content.review;
  if (!review) {
    throw new DraftValidationError(
      "Chưa có dữ liệu để phê duyệt — vui lòng phân tích bằng AI hoặc nhập thủ công trước.",
    );
  }
  if (!draft.suggestedSubjectId) {
    throw new DraftValidationError("Vui lòng chọn môn học trước khi phê duyệt.", {
      subjectId: "Vui lòng chọn môn học.",
    });
  }
  if (!draft.suggestedTopicId) {
    throw new DraftValidationError("Vui lòng chọn chủ đề trước khi phê duyệt.", {
      topicId: "Vui lòng chọn chủ đề.",
    });
  }
  if (!draft.suggestedDifficulty) {
    throw new DraftValidationError("Vui lòng chọn độ khó trước khi phê duyệt.", {
      difficulty: "Vui lòng chọn độ khó.",
    });
  }
  if (!review.questionType) {
    throw new DraftValidationError("Vui lòng chọn loại câu hỏi trước khi phê duyệt.", {
      type: "Vui lòng chọn loại câu hỏi.",
    });
  }

  const questionInput = {
    content: review.questionText,
    type: review.questionType,
    subjectId: draft.suggestedSubjectId,
    topicId: draft.suggestedTopicId,
    difficulty: draft.suggestedDifficulty,
    cognitiveLevel: review.cognitiveLevel ?? undefined,
    hint: undefined,
    explanation: review.explanation ?? undefined,
    source: undefined,
    year: undefined,
    tags: review.tags,
    status: "ACTIVE" as const,
    correctAnswerText: review.correctAnswerText ?? undefined,
    trueFalseAnswer: deriveTrueFalseAnswer(review),
    options: review.options.map((o) => ({ id: o.id, content: o.text, isCorrect: o.isCorrect })),
  };

  const validation = validateQuestionInput(questionInput);
  if (!validation.success) {
    throw new DraftValidationError("Dữ liệu câu hỏi không hợp lệ — vui lòng kiểm tra lại.", validation.errors);
  }

  const question = await prisma.$transaction(async (tx) => {
    // Kiểm tra lại NGAY TRONG transaction để đóng race condition khi Admin
    // bấm Approve 2 lần gần như đồng thời (2 request có thể cùng vượt qua
    // check phía trên trước khi request nào kịp ghi dữ liệu).
    const fresh = await tx.importQuestionDraft.findUnique({ where: { id: draftId } });
    if (!fresh) throw new DraftNotFoundError();
    if (fresh.status !== "PENDING") throw new DraftAlreadyApprovedError();

    const created = await createQuestion(validation.data, approvedById, tx);

    await tx.importQuestionDraft.update({
      where: { id: draftId },
      data: {
        status: "APPROVED",
        approvedQuestionId: created.id,
        reviewedById: approvedById,
        reviewedAt: new Date(),
      },
    });

    return created;
  });

  return { question, alreadyApproved: false as const };
}

export interface RejectDraftInput {
  reason?: string | null;
}

export async function rejectDraft(draftId: string, rejectedById: string, input: RejectDraftInput) {
  const draft = await prisma.importQuestionDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw new DraftNotFoundError();
  if (draft.status === "APPROVED") throw new DraftAlreadyApprovedError();
  if (draft.status === "REJECTED") return draft;

  const content = readDraftParsedContent(draft.parsedContent);
  content.rejectReason = input.reason ?? null;

  return prisma.importQuestionDraft.update({
    where: { id: draftId },
    data: {
      status: "REJECTED",
      reviewedById: rejectedById,
      reviewedAt: new Date(),
      parsedContent: content as object,
    },
  });
}
