import "server-only";
import { prisma } from "@/lib/prisma";
import { parseExamSnapshot, type ExamSnapshot, type SnapshotQuestion } from "./examSnapshotService";

/**
 * Ghi chú quyết định thiết kế (Phase 9B) — không được suy đoán, đã xác nhận
 * qua inspect schema + hỏi lại người dùng cho phần còn mơ hồ:
 *
 * - MULTIPLE_CHOICE/SINGLE_CHOICE/TRUE_FALSE: AttemptAnswer.isCorrect là
 *   Boolean? (không phải Float phân số) — schema không có chỗ lưu điểm từng
 *   phần, nên chấm theo kiểu "khớp chính xác tập lựa chọn" (exact set match),
 *   không cộng điểm từng option, không trừ điểm khi chọn thiếu.
 * - SHORT_ANSWER: so khớp answerText với correctAnswerText sau khi trim +
 *   lowercase + gộp khoảng trắng liên tiếp — KHÔNG chuẩn hoá dấu tiếng Việt,
 *   KHÔNG có tolerance số học, KHÔNG hỗ trợ nhiều đáp án đúng. Quyết định này
 *   được người dùng xác nhận trực tiếp (không phải giả định của model) vì
 *   Phase 6 cố ý để ngỏ rule này ("sẽ được xây ở Practice Engine sau").
 * - Không điểm âm — không có tín hiệu nào trong schema/thiết kế trước yêu
 *   cầu trừ điểm.
 * - maxScore mỗi câu = SnapshotQuestion.points (mặc định 1 nếu thiếu — bù cho
 *   snapshot tạo trước khi field này tồn tại), KHÔNG lưu maxScore vào DB vì
 *   Attempt model không có cột này — đây là giá trị luôn tính lại được từ
 *   snapshot (rẻ, xác định), khác với score/correctCount/... vốn phụ thuộc
 *   answer nên mới đáng lưu một lần.
 */

export interface AnswerLike {
  questionId: string;
  selectedOptionIds: unknown;
  answerText: string | null;
}

export interface QuestionScoreResult {
  questionId: string;
  order: number;
  isAnswered: boolean;
  isCorrect: boolean;
  score: number;
  maxScore: number;
}

export interface AttemptScoreResult {
  totalScore: number;
  maxScore: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  questionResults: QuestionScoreResult[];
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function normalizeShortAnswer(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Chấp nhận mọi giá trị không phải mảng string hợp lệ như [] — dữ liệu hỏng không được làm crash scoring (mục 15). */
function toOptionIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function questionMaxScore(q: SnapshotQuestion): number {
  return typeof q.points === "number" && q.points > 0 ? q.points : 1;
}

export function computeMaxScore(snapshot: ExamSnapshot): number {
  return round2(snapshot.questions.reduce((sum, q) => sum + questionMaxScore(q), 0));
}

/**
 * Chấm một câu — thuần, không DB. Không trả điểm âm và không có "đúng một
 * phần": SINGLE_CHOICE/MULTIPLE_CHOICE/TRUE_FALSE đều quy về so khớp tập
 * option đã chọn với tập option đúng trong snapshot (giống nhau về bản chất,
 * chỉ khác số lượng option đúng kỳ vọng). SHORT_ANSWER so khớp text đã chuẩn
 * hoá. Không tồn tại AttemptAnswer cho câu này (chưa từng lưu) → coi như
 * chưa trả lời, không phải sai — giữ đúng phân biệt mục 9/20 của Phase 9A.
 */
function scoreQuestion(question: SnapshotQuestion, answer: AnswerLike | undefined): QuestionScoreResult {
  const maxScore = questionMaxScore(question);
  const base = { questionId: question.questionId, order: question.order, maxScore };

  if (question.type === "SHORT_ANSWER") {
    const submitted = answer?.answerText?.trim() ?? "";
    const isAnswered = submitted.length > 0;
    const key = question.correctAnswerText?.trim() ?? "";
    const isCorrect = isAnswered && key.length > 0 && normalizeShortAnswer(submitted) === normalizeShortAnswer(key);
    return { ...base, isAnswered, isCorrect, score: isCorrect ? maxScore : 0 };
  }

  // SINGLE_CHOICE / MULTIPLE_CHOICE / TRUE_FALSE
  const selected = [...new Set(toOptionIdArray(answer?.selectedOptionIds))];
  const isAnswered = selected.length > 0;
  const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
  const isCorrect =
    isAnswered && selected.length === correctIds.length && selected.every((id) => correctIds.includes(id));
  return { ...base, isAnswered, isCorrect, score: isCorrect ? maxScore : 0 };
}

/**
 * Engine chấm điểm thuần — chỉ đọc snapshot + answers, không truy vấn DB,
 * không phụ thuộc Question/QuestionOption hiện tại (mục 3). Duyệt theo
 * snapshot.questions (nguồn sự thật) nên một AttemptAnswer mồ côi (tham
 * chiếu câu hỏi không còn trong snapshot) tự động bị bỏ qua, không crash.
 */
export function scoreAttempt(snapshot: ExamSnapshot, answers: AnswerLike[]): AttemptScoreResult {
  const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a]));
  const questionResults = [...snapshot.questions]
    .sort((a, b) => a.order - b.order)
    .map((q) => scoreQuestion(q, answerByQuestionId.get(q.questionId)));

  const totalScore = round2(questionResults.reduce((sum, r) => sum + r.score, 0));
  const maxScore = round2(questionResults.reduce((sum, r) => sum + r.maxScore, 0));
  const correctCount = questionResults.filter((r) => r.isAnswered && r.isCorrect).length;
  const wrongCount = questionResults.filter((r) => r.isAnswered && !r.isCorrect).length;
  const unansweredCount = questionResults.filter((r) => !r.isAnswered).length;

  return { totalScore, maxScore, correctCount, wrongCount, unansweredCount, questionResults };
}

/**
 * Chấm và lưu kết quả — idempotent theo 2 lớp bảo vệ: (1) đọc trước, bỏ qua
 * nếu Attempt.score đã khác null; (2) updateMany với where score:null làm
 * lớp chốt cuối ở tầng DB, phòng trường hợp 2 request cùng vượt qua bước (1)
 * do race (mục 12/24) — chỉ một request thực sự ghi được, không cộng dồn,
 * không tạo bản ghi khác. Không throw ra ngoài khi snapshot hỏng (mục 15) —
 * log lỗi rồi bỏ qua, để không chặn luồng Submit/Auto-submit vốn là trách
 * nhiệm chính của studentAttemptService.
 */
export async function scoreAndPersistIfNeeded(attemptId: string): Promise<void> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { examSnapshot: true, score: true },
  });
  if (!attempt || attempt.score !== null) return;

  let snapshot: ExamSnapshot;
  try {
    snapshot = parseExamSnapshot(attempt.examSnapshot);
    if (!snapshot || !Array.isArray(snapshot.questions)) {
      throw new Error("Snapshot không đúng cấu trúc mong đợi (thiếu questions[]).");
    }
  } catch (error) {
    console.error(`[scoreAndPersistIfNeeded] snapshot hỏng cho attempt ${attemptId}`, error);
    return;
  }

  const rawAnswers = await prisma.attemptAnswer.findMany({
    where: { attemptId },
    select: { questionId: true, selectedOptionIds: true, answerText: true },
  });
  const answers: AnswerLike[] = rawAnswers
    .filter((a): a is typeof a & { questionId: string } => a.questionId !== null)
    .map((a) => ({ questionId: a.questionId, selectedOptionIds: a.selectedOptionIds, answerText: a.answerText }));

  const result = scoreAttempt(snapshot, answers);

  await prisma.attempt.updateMany({
    where: { id: attemptId, score: null },
    data: {
      score: result.totalScore,
      correctCount: result.correctCount,
      wrongCount: result.wrongCount,
      unansweredCount: result.unansweredCount,
    },
  });
}
