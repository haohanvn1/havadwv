import "server-only";
import type { ParsedDocument, ParsedDocumentPage } from "./documentParser";

export interface QuestionCandidate {
  order: number;
  questionNumberLabel: string | null;
  rawText: string;
  pageNumber: number | null;
  detectionMethod: string;
  confidence: "high" | "low";
  warning: string | null;
}


/**
 * Thử lần lượt từng pattern theo độ đặc hiệu giảm dần — pattern càng cụ thể
 * ("Câu 1.") càng ít khả năng nhận nhầm option liệt kê dạng số ("1. Paris")
 * thành câu hỏi mới, nên được ưu tiên thử trước "plain-number".
 *
 * Dùng lookbehind "trước đó là đầu chuỗi hoặc khoảng trắng" thay vì bắt buộc
 * đúng đầu DÒNG (^ + flag m): text PDF thật (pdfParser.ts nối các item trong
 * một trang bằng dấu cách, không phải "\n") thường không có xuống dòng giữa
 * các câu hỏi trên cùng một trang — nếu chỉ khớp đầu dòng, mọi câu hỏi trừ
 * câu đầu trang sẽ bị bỏ sót (đã xác nhận bằng file đề thi PDF thật: chỉ
 * tách được 4/22 câu trước khi sửa).
 *
 * Chữ "C"/"Q" bắt buộc viết hoa (bỏ flag "i" cho riêng ký tự đầu bằng cách
 * liệt kê tường minh, không dùng "i" toàn cục) để không khớp nhầm các câu
 * dẫn tự nhiên kiểu "...trả lời từ câu 1 đến câu 12" (chữ thường, không phải
 * ranh giới câu hỏi mới) — cũng xác nhận bằng file thật: nếu không phân biệt
 * hoa/thường sẽ dư ra đúng các cụm "câu 1"/"câu N" trong câu dẫn mỗi phần.
 */
const PATTERNS: { method: string; regex: RegExp }[] = [
  { method: "cau-prefix", regex: /(?<=^|\s)C[aâ]u[ \t]*(\d+)[.:)]/gm },
  { method: "question-prefix", regex: /(?<=^|\s)Question[ \t]*(\d+)[.:)]?/gm },
  { method: "plain-number", regex: /(?<=^|\s)(\d+)[.)][ \t]+/gm },
];

const NO_STRUCTURE_WARNING =
  "Không phát hiện được cấu trúc câu hỏi rõ ràng. Vui lòng kiểm tra lại.";

interface PageOffset {
  pageNumber: number;
  start: number;
  end: number;
}

/** `text` luôn được các parser dựng bằng `pages.map(p => p.text).join("\n")` — offset ở đây phải khớp đúng cách nối đó. */
function buildPageOffsets(pages: ParsedDocumentPage[] | undefined): PageOffset[] | null {
  if (!pages || pages.length === 0) return null;
  const offsets: PageOffset[] = [];
  let cursor = 0;
  for (const page of pages) {
    const start = cursor;
    const end = start + page.text.length;
    offsets.push({ pageNumber: page.pageNumber, start, end });
    cursor = end + 1; // +1 cho dấu "\n" nối giữa các trang.
  }
  return offsets;
}

function findPageNumber(offsets: PageOffset[] | null, charIndex: number): number | null {
  if (!offsets) return null;
  const match = offsets.find((o) => charIndex >= o.start && charIndex <= o.end);
  return (match ?? offsets[offsets.length - 1])?.pageNumber ?? null;
}

function splitByPattern(
  document: ParsedDocument,
  pattern: { method: string; regex: RegExp },
  pageOffsets: PageOffset[] | null,
): QuestionCandidate[] {
  const text = document.text;
  const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
  const matches = [...text.matchAll(regex)];
  if (matches.length < 2) return [];

  const candidates: QuestionCandidate[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const rawText = text.slice(start, end).trim();
    if (!rawText) continue;

    candidates.push({
      order: candidates.length,
      questionNumberLabel: matches[i][1] ?? null,
      rawText,
      pageNumber: findPageNumber(pageOffsets, start),
      detectionMethod: pattern.method,
      confidence: "high",
      warning: null,
    });
  }
  return candidates;
}

/**
 * Không AI — chỉ dò theo pattern phổ biến. Nếu không pattern nào khớp được ít
 * nhất 2 lần (tức không đủ tin cậy là một cách chia đề nhất quán), giữ nguyên
 * toàn bộ raw text thành 1 draft duy nhất, đánh dấu cảnh báo — không bao giờ
 * làm mất dữ liệu chỉ vì không detect được cấu trúc.
 */
export function detectQuestionCandidates(document: ParsedDocument): QuestionCandidate[] {
  const pageOffsets = buildPageOffsets(document.pages);

  for (const pattern of PATTERNS) {
    const candidates = splitByPattern(document, pattern, pageOffsets);
    if (candidates.length >= 2) return candidates;
  }

  return [
    {
      order: 0,
      questionNumberLabel: null,
      rawText: document.text.trim(),
      pageNumber: document.pages?.[0]?.pageNumber ?? null,
      detectionMethod: "fallback-whole-document",
      confidence: "low",
      warning: NO_STRUCTURE_WARNING,
    },
  ];
}
