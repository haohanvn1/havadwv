import "server-only";
import type { AIQuestionExtractor, QuestionExtractionInput, QuestionExtractionResult } from "./types";

/**
 * KHÔNG gọi AI thật — chỉ dùng pattern đơn giản trên chính rawText để demo
 * luồng UI (badge confidence, warning, review) khi chưa cấu hình AI_API_KEY
 * thật, ví dụ ở môi trường dev/QA cục bộ. Không được dùng ở production (factory
 * chặn theo NODE_ENV — xem index.ts). Không thay thế cho AnthropicQuestionExtractor.
 */
export class DemoQuestionExtractor implements AIQuestionExtractor {
  async extract(input: QuestionExtractionInput): Promise<QuestionExtractionResult> {
    const text = input.rawText;
    const warnings: string[] = ["Kết quả demo — KHÔNG phải AI thật (AI_PROVIDER=demo)."];

    const isTrueFalseCompound = /\*?\s*[a-d]\)/i.test(text) && /\*?\s*[a-d]\)/gi.test(text);
    const optionMatches = [...text.matchAll(/\*?\s*([A-D])[.)]\s*([^*A-D]{0,80})/g)];

    let questionType: QuestionExtractionResult["questionType"] = "SHORT_ANSWER";
    const options: QuestionExtractionResult["options"] = [];

    if (isTrueFalseCompound && optionMatches.length === 0) {
      questionType = "TRUE_FALSE";
      const markedA = /\*\s*a\)/i.test(text);
      options.push({ label: "A", text: "Đúng", isCorrect: markedA });
      options.push({ label: "B", text: "Sai", isCorrect: !markedA });
      warnings.push(
        "Câu hỏi gốc có nhiều ý đúng/sai (a, b, c, d) — đã trích xuất ý (a) làm đại diện, vui lòng xem raw text và sửa thủ công.",
      );
    } else if (optionMatches.length >= 2) {
      const correctCount = optionMatches.filter((m) => m[0].trim().startsWith("*")).length;
      questionType = correctCount > 1 ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE";
      for (const match of optionMatches) {
        const isCorrect = match[0].trim().startsWith("*");
        const optionText = match[2].trim().replace(/\.$/, "");
        options.push({ label: match[1], text: optionText || "(nội dung có thể đã bị mất khi trích xuất)", isCorrect });
        if (!optionText) warnings.push(`Nội dung đáp án ${match[1]} có thể đã bị mất khi trích xuất.`);
      }
    }

    const answerKeyMatch = text.match(/Đ(?:áp\s*án|\/án)\s*[:.]?\s*([^\n]{1,80})/i);
    const correctAnswerText = questionType === "SHORT_ANSWER" ? (answerKeyMatch?.[1].trim() ?? null) : null;
    if (questionType === "SHORT_ANSWER" && !correctAnswerText) {
      warnings.push("Không xác định được đáp án.");
    }

    const questionTextOnly = text
      .replace(/\*?\s*[A-D][.)][^*A-D]{0,80}/g, "")
      .replace(/Hướng dẫn giải[\s\S]*$/i, "")
      .replace(/Đ(?:áp\s*án|\/án)\s*[:.]?\s*[^\n]{1,80}/i, "")
      .trim();

    if (/hình vẽ|hình minh họa|như hình|bảng dưới/i.test(text)) {
      warnings.push("Nội dung câu hỏi có hình ảnh/bảng chưa được xử lý.");
    }

    const confidence = warnings.length > 1 ? 0.4 : options.length > 0 || correctAnswerText ? 0.85 : 0.3;

    return {
      questionText: questionTextOnly || text.slice(0, 200),
      questionType,
      options,
      correctAnswerText,
      explanation: null,
      suggestedSubjectText: null,
      suggestedTopicText: null,
      difficulty: null,
      cognitiveLevel: null,
      tags: [],
      confidence,
      warnings,
    };
  }
}
