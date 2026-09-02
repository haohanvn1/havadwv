import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  buildMockExtractionResult,
  MockAIQuestionExtractor,
} from "@/server/services/ai/mockQuestionExtractor";
import { AIExtractionError } from "@/server/services/ai/types";
import { setAIQuestionExtractorForTesting } from "@/server/services/ai";
import {
  DraftAlreadyApprovedError,
  extractAllDraftsForJob,
  extractDraft,
} from "@/server/services/questionAIExtractionService";
import { readDraftParsedContent } from "@/server/services/importDraftContent";

// Test này chạy trên database dev thật — tự tạo ImportedFile/ImportJob/ImportQuestionDraft
// riêng (prefix "[vitest-ai]") và dọn sạch sau khi chạy. KHÔNG gọi AI thật —
// luôn tiêm MockAIQuestionExtractor qua setAIQuestionExtractorForTesting.

let uploaderId: string;
const createdImportedFileIds: string[] = [];

async function createDraft(rawText: string) {
  const uploadedFile = await prisma.importedFile.create({
    data: {
      filename: "[vitest-ai] fixture.pdf",
      storagePath: `imports/vitest-ai/${crypto.randomUUID()}/original.pdf`,
      mimeType: "application/pdf",
      sizeBytes: rawText.length,
      uploadedById: uploaderId,
    },
  });
  createdImportedFileIds.push(uploadedFile.id);

  const job = await prisma.importJob.create({
    data: { importedFileId: uploadedFile.id, status: "DONE", totalExtracted: 1 },
  });

  const draft = await prisma.importQuestionDraft.create({
    data: {
      importJobId: job.id,
      rawText,
      parsedContent: {
        detection: {
          questionNumberLabel: "1",
          pageNumber: 1,
          detectionMethod: "cau-prefix",
          confidence: "high",
          warning: null,
          order: 0,
        },
      },
    },
  });

  return draft;
}

beforeAll(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  uploaderId = admin.id;
});

afterEach(() => {
  setAIQuestionExtractorForTesting(null);
});

afterAll(async () => {
  if (createdImportedFileIds.length > 0) {
    await prisma.importedFile.deleteMany({ where: { id: { in: createdImportedFileIds } } });
  }
  await prisma.$disconnect();
});

describe("extractDraft — các loại câu hỏi hợp lệ", () => {
  it("SINGLE_CHOICE — lưu đúng aiExtraction + khởi tạo review", async () => {
    const draft = await createDraft("Câu 1. 2+2=? *A. 3 B. 4 C. 5 D. 6");
    setAIQuestionExtractorForTesting(
      new MockAIQuestionExtractor(
        buildMockExtractionResult({ questionType: "SINGLE_CHOICE", confidence: 0.92 }),
      ),
    );

    const updated = await extractDraft(draft.id);
    const content = readDraftParsedContent(updated.parsedContent);

    expect(content.aiExtraction?.status).toBe("DONE");
    expect(content.aiExtraction?.result?.questionType).toBe("SINGLE_CHOICE");
    expect(content.review?.questionType).toBe("SINGLE_CHOICE");
    expect(content.review?.options).toHaveLength(2);
  });

  it("MULTIPLE_CHOICE hợp lệ", async () => {
    const draft = await createDraft("Câu 2. Số nào chia hết cho 3? *A. 3 B. 5 *C. 6 D. 7");
    setAIQuestionExtractorForTesting(
      new MockAIQuestionExtractor(
        buildMockExtractionResult({
          questionType: "MULTIPLE_CHOICE",
          options: [
            { label: "A", text: "3", isCorrect: true },
            { label: "B", text: "5", isCorrect: false },
            { label: "C", text: "6", isCorrect: true },
            { label: "D", text: "7", isCorrect: false },
          ],
        }),
      ),
    );

    const updated = await extractDraft(draft.id);
    const content = readDraftParsedContent(updated.parsedContent);
    expect(content.review?.options.filter((o) => o.isCorrect)).toHaveLength(2);
  });

  it("TRUE_FALSE hợp lệ", async () => {
    const draft = await createDraft("Câu 3. Trái đất hình tròn. *A. Đúng B. Sai");
    setAIQuestionExtractorForTesting(
      new MockAIQuestionExtractor(
        buildMockExtractionResult({
          questionType: "TRUE_FALSE",
          options: [
            { label: "A", text: "Đúng", isCorrect: true },
            { label: "B", text: "Sai", isCorrect: false },
          ],
        }),
      ),
    );

    const updated = await extractDraft(draft.id);
    const content = readDraftParsedContent(updated.parsedContent);
    expect(content.review?.questionType).toBe("TRUE_FALSE");
    expect(content.review?.options[0].isCorrect).toBe(true);
  });

  it("SHORT_ANSWER hợp lệ", async () => {
    const draft = await createDraft("Câu 4. Tính 1+1. Đáp án: 2");
    setAIQuestionExtractorForTesting(
      new MockAIQuestionExtractor(
        buildMockExtractionResult({
          questionType: "SHORT_ANSWER",
          options: [],
          correctAnswerText: "2",
        }),
      ),
    );

    const updated = await extractDraft(draft.id);
    const content = readDraftParsedContent(updated.parsedContent);
    expect(content.review?.questionType).toBe("SHORT_ANSWER");
    expect(content.review?.correctAnswerText).toBe("2");
    expect(content.review?.options).toHaveLength(0);
  });
});

describe("extractDraft — lỗi & cảnh báo", () => {
  it("AI trả lỗi (vd timeout/rate limit) → draft không mất, status FAILED, có errorMessage thân thiện", async () => {
    const draft = await createDraft("Câu 5. Nội dung bất kỳ.");
    setAIQuestionExtractorForTesting(
      new MockAIQuestionExtractor(new AIExtractionError("AI đang bị giới hạn tốc độ (rate limit).")),
    );

    await expect(extractDraft(draft.id)).rejects.toBeInstanceOf(AIExtractionError);

    const fresh = await prisma.importQuestionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    const content = readDraftParsedContent(fresh.parsedContent);
    expect(content.aiExtraction?.status).toBe("FAILED");
    expect(content.aiExtraction?.errorMessage).toContain("rate limit");
    // rawText (nguồn sự thật) không bao giờ bị mất dù AI lỗi.
    expect(fresh.rawText).toBe("Câu 5. Nội dung bất kỳ.");
  });

  it("confidence thấp + warnings được lưu nguyên vẹn để UI hiển thị", async () => {
    const draft = await createDraft("Câu 6. Nội dung mơ hồ, thiếu đáp án.");
    setAIQuestionExtractorForTesting(
      new MockAIQuestionExtractor(
        buildMockExtractionResult({
          confidence: 0.2,
          warnings: ["Không xác định được đáp án.", "Nội dung câu hỏi có hình ảnh chưa được xử lý."],
        }),
      ),
    );

    const updated = await extractDraft(draft.id);
    const content = readDraftParsedContent(updated.parsedContent);
    expect(content.aiExtraction?.result?.confidence).toBe(0.2);
    expect(content.aiExtraction?.result?.warnings).toHaveLength(2);
  });

  it("draft đã APPROVED → từ chối phân tích lại", async () => {
    const draft = await createDraft("Câu 7. Đã duyệt rồi.");
    await prisma.importQuestionDraft.update({ where: { id: draft.id }, data: { status: "APPROVED" } });

    await expect(extractDraft(draft.id)).rejects.toBeInstanceOf(DraftAlreadyApprovedError);
  });

  it("không tồn tại draft → DraftNotFoundError", async () => {
    await expect(extractDraft("00000000-0000-4000-8000-000000000000")).rejects.toThrow(
      "Không tìm thấy câu hỏi nháp.",
    );
  });
});

describe("extractAllDraftsForJob — batch có giới hạn concurrency", () => {
  it("xử lý toàn bộ draft PENDING trong job, bỏ qua draft đã APPROVED", async () => {
    const uploadedFile = await prisma.importedFile.create({
      data: {
        filename: "[vitest-ai] batch.pdf",
        storagePath: `imports/vitest-ai/${crypto.randomUUID()}/original.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 100,
        uploadedById: uploaderId,
      },
    });
    createdImportedFileIds.push(uploadedFile.id);
    const job = await prisma.importJob.create({
      data: { importedFileId: uploadedFile.id, status: "DONE", totalExtracted: 3 },
    });

    const makeDraft = (text: string) =>
      prisma.importQuestionDraft.create({
        data: {
          importJobId: job.id,
          rawText: text,
          parsedContent: {
            detection: {
              questionNumberLabel: null,
              pageNumber: null,
              detectionMethod: "cau-prefix",
              confidence: "high",
              warning: null,
              order: 0,
            },
          },
        },
      });

    const d1 = await makeDraft("Câu A");
    const d2 = await makeDraft("Câu B");
    const d3 = await makeDraft("Câu C (đã duyệt)");
    await prisma.importQuestionDraft.update({ where: { id: d3.id }, data: { status: "APPROVED" } });

    setAIQuestionExtractorForTesting(new MockAIQuestionExtractor(buildMockExtractionResult()));

    const results = await extractAllDraftsForJob(job.id);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.map((r) => r.draftId).sort()).toEqual([d1.id, d2.id].sort());
  });
});
