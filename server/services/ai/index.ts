import "server-only";
import { AnthropicQuestionExtractor } from "./anthropicQuestionExtractor";
import { DemoQuestionExtractor } from "./demoQuestionExtractor";
import { AIProviderNotConfiguredError, type AIQuestionExtractor } from "./types";

export type {
  AIQuestionExtractor,
  QuestionExtractionInput,
  QuestionExtractionResult,
} from "./types";
export { AIExtractionError, AIProviderNotConfiguredError, questionExtractionResultSchema } from "./types";

let cachedExtractor: AIQuestionExtractor | null = null;

/**
 * Factory duy nhất tạo AIQuestionExtractor theo cấu hình server-side
 * (AI_PROVIDER/AI_API_KEY/AI_MODEL) — business logic (questionAIExtractionService)
 * không bao giờ import trực tiếp một provider cụ thể, chỉ gọi hàm này. Thêm
 * provider mới chỉ cần thêm 1 case ở đây.
 */
export function getAIQuestionExtractor(): AIQuestionExtractor {
  if (cachedExtractor) return cachedExtractor;

  const provider = process.env.AI_PROVIDER;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || "claude-opus-5";

  if (!provider) {
    throw new AIProviderNotConfiguredError(
      "Chưa cấu hình AI_PROVIDER — tính năng phân tích AI hiện không khả dụng.",
    );
  }

  if (provider === "anthropic") {
    if (!apiKey) {
      throw new AIProviderNotConfiguredError("Thiếu AI_API_KEY cho provider anthropic.");
    }
    cachedExtractor = new AnthropicQuestionExtractor(apiKey, model);
    return cachedExtractor;
  }

  // Chỉ cho phép ở dev — mô phỏng kết quả bằng pattern đơn giản trên chính
  // rawText để kiểm thử luồng UI (badge confidence, warning...) khi chưa có
  // AI_API_KEY thật, không bao giờ được kích hoạt ở production dù lỡ cấu hình sai.
  if (provider === "demo" && process.env.NODE_ENV !== "production") {
    cachedExtractor = new DemoQuestionExtractor();
    return cachedExtractor;
  }

  throw new AIProviderNotConfiguredError(`AI_PROVIDER "${provider}" không được hỗ trợ.`);
}

/** Dùng trong test để tiêm MockAIQuestionExtractor thay vì gọi AI thật. */
export function setAIQuestionExtractorForTesting(extractor: AIQuestionExtractor | null): void {
  cachedExtractor = extractor;
}
