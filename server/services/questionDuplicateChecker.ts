import "server-only";
import { prisma } from "@/lib/prisma";

/** Chuẩn hoá text để so khớp gần đúng: bỏ dấu câu/khoảng trắng thừa, hạ chữ thường. Không xử lý ngữ nghĩa (semantic) — chỉ exact/normalized match theo đúng yêu cầu Phase 7B (không over-engineer). */
function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?()"'`]/g, "")
    .trim();
}

/**
 * Kiểm tra trùng lặp tối thiểu (exact/normalized match) trước khi approve —
 * không tự động reject, chỉ trả về cảnh báo để Admin tự quyết định (mục 29).
 * Không có hạ tầng full-text similarity nên KHÔNG làm semantic search ở đây.
 */
export async function findPossibleDuplicateQuestions(questionText: string, limit = 3) {
  const normalizedTarget = normalizeQuestionText(questionText);
  if (!normalizedTarget) return [];

  // So khớp ở tầng ứng dụng vì Postgres không có sẵn hàm normalize tương ứng
  // để so trong WHERE. Chấp nhận được ở quy mô hiện tại (chỉ chạy 1 lần lúc
  // approve, không phải trên đường truy vấn danh sách nóng) — nếu ngân hàng
  // câu hỏi lớn lên đáng kể, nên thay bằng cột generated + index thay vì quét
  // toàn bộ, nhưng đó là tối ưu hoá cho sau, không phải yêu cầu Phase 7B.
  const candidates = await prisma.question.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: { id: true, content: true, status: true },
  });

  const matches = candidates.filter((q) => normalizeQuestionText(q.content) === normalizedTarget);
  return matches.slice(0, limit);
}
