import type { Difficulty, QuestionStatus, QuestionType } from "@/lib/generated/prisma/enums";

/** Tập field tối thiểu của Question cần để so khớp Rule — không phụ thuộc Prisma. */
export interface MatchableQuestion {
  id: string;
  status: QuestionStatus;
  subjectId: string;
  topicId: string;
  type: QuestionType;
  difficulty: Difficulty;
  cognitiveLevel: string | null;
  year: number | null;
  source: string | null;
  tags: string[];
}

/** Tập field tối thiểu của BlueprintRule cần để so khớp — field null/undefined nghĩa là "không lọc theo field đó". */
export interface MatchableRule {
  subjectId: string | null;
  topicId: string | null;
  questionType: QuestionType | null;
  difficulty: Difficulty | null;
  cognitiveLevel: string | null;
  year: number | null;
  source: string | null;
  requiredTags: string[];
}

/**
 * So khớp thuần (không DB, không side-effect) giữa một Question và một
 * BlueprintRule — trung tâm hoá luật ngữ nghĩa (mục 9 spec Phase 8):
 * field không chỉ định trên Rule = không lọc theo field đó; field có chỉ
 * định = Question phải khớp chính xác. Question không ACTIVE không bao giờ
 * match, bất kể rule gì — đây là guard phòng thủ, tầng query candidate ở
 * examGenerationService cũng lọc status=ACTIVE, nhưng hàm này vẫn tự đứng
 * vững và test được độc lập.
 */
export function questionMatchesRule(question: MatchableQuestion, rule: MatchableRule): boolean {
  if (question.status !== "ACTIVE") return false;
  if (rule.subjectId && question.subjectId !== rule.subjectId) return false;
  if (rule.topicId && question.topicId !== rule.topicId) return false;
  if (rule.questionType && question.type !== rule.questionType) return false;
  if (rule.difficulty && question.difficulty !== rule.difficulty) return false;

  if (rule.cognitiveLevel) {
    if (!question.cognitiveLevel || question.cognitiveLevel !== rule.cognitiveLevel) return false;
  }
  if (rule.year && question.year !== rule.year) return false;
  if (rule.source && question.source !== rule.source) return false;

  if (rule.requiredTags.length > 0) {
    const questionTags = new Set(question.tags);
    if (!rule.requiredTags.every((tag) => questionTags.has(tag))) return false;
  }

  return true;
}

/**
 * PRNG xác định (mulberry32) — cùng seed luôn sinh cùng chuỗi số, khác seed
 * (rất nhiều khả năng) sinh chuỗi khác. Chuyển seed dạng chuỗi thành số 32-bit
 * bằng một hash đơn giản (djb2) trước khi cấp cho PRNG.
 */
function hashSeed(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Trộn xác định một danh sách id theo seed (Fisher-Yates dùng PRNG đã seed).
 * Cùng danh sách đầu vào (cùng thứ tự) + cùng seed → luôn ra cùng thứ tự sau
 * khi trộn. Danh sách đầu vào phải được truyền theo một thứ tự ổn định (vd
 * ORDER BY id ASC ở tầng query) để đảm bảo tính xác định thật sự — PRNG chỉ
 * quyết định phần hoán vị, không tự sắp xếp lại input.
 */
export function deterministicShuffle<T>(items: readonly T[], seed: string): T[] {
  const rng = mulberry32(hashSeed(seed));
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
