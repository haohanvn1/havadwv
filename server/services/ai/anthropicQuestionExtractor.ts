import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AI_MAX_INPUT_CHARS } from "@/lib/constants/ai";
import { QUESTION_EXTRACTION_SYSTEM_PROMPT, buildQuestionExtractionUserMessage } from "./prompt";
import {
  AIExtractionError,
  questionExtractionResultSchema,
  type AIQuestionExtractor,
  type QuestionExtractionInput,
  type QuestionExtractionResult,
} from "./types";

export class AnthropicQuestionExtractor implements AIQuestionExtractor {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async extract(input: QuestionExtractionInput): Promise<QuestionExtractionResult> {
    const userMessage = buildQuestionExtractionUserMessage(input, AI_MAX_INPUT_CHARS);

    let response;
    try {
      response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 4096,
        system: QUESTION_EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
        output_config: { format: zodOutputFormat(questionExtractionResultSchema) },
      });
    } catch (error) {
      throw mapAnthropicError(error);
    }

    if (!response.parsed_output) {
      throw new AIExtractionError("AI không trả về dữ liệu đúng định dạng.", undefined, true);
    }

    // AI output luôn là untrusted input dù structured output "đảm bảo" schema
    // — re-validate lại bằng chính schema đó trước khi tin dùng.
    const revalidated = questionExtractionResultSchema.safeParse(response.parsed_output);
    if (!revalidated.success) {
      throw new AIExtractionError("Dữ liệu AI trả về không hợp lệ.", revalidated.error, true);
    }

    return revalidated.data;
  }
}

function mapAnthropicError(error: unknown): AIExtractionError {
  if (error instanceof Anthropic.AuthenticationError) {
    return new AIExtractionError("Cấu hình AI không hợp lệ (sai API key).", error, false);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AIExtractionError("AI đang bị giới hạn tốc độ (rate limit). Vui lòng thử lại sau.", error, true);
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AIExtractionError("Yêu cầu tới AI bị timeout.", error, true);
  }
  if (error instanceof Anthropic.APIError) {
    return new AIExtractionError(`Lỗi từ AI provider (${error.status ?? "?"}).`, error, true);
  }
  return new AIExtractionError("Không thể kết nối tới AI provider.", error, true);
}
