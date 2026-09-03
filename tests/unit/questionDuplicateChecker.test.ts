import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { findPossibleDuplicateQuestions } from "@/server/services/questionDuplicateChecker";

let subjectId: string;
let topicId: string;
const createdQuestionIds: string[] = [];

beforeAll(async () => {
  const subject = await prisma.subject.findUniqueOrThrow({ where: { slug: "toan" } });
  const topic = await prisma.topic.findFirstOrThrow({ where: { subjectId: subject.id } });
  subjectId = subject.id;
  topicId = topic.id;
});

afterAll(async () => {
  if (createdQuestionIds.length > 0) {
    await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
  }
  await prisma.$disconnect();
});

describe("findPossibleDuplicateQuestions", () => {
  it("tìm thấy câu hỏi khớp chính xác sau khi chuẩn hoá (khoảng trắng/dấu câu/hoa-thường)", async () => {
    const question = await prisma.question.create({
      data: {
        content: "[vitest-dup] Tính  2 + 2   bằng bao nhiêu?",
        type: "SHORT_ANSWER",
        difficulty: "EASY",
        subjectId,
        topicId,
        status: "ACTIVE",
        correctAnswerText: "4",
      },
    });
    createdQuestionIds.push(question.id);

    const matches = await findPossibleDuplicateQuestions("[VITEST-DUP]   TÍNH 2 + 2 bằng bao nhiêu?");
    expect(matches.some((m) => m.id === question.id)).toBe(true);
  });

  it("không tìm thấy khi nội dung thực sự khác", async () => {
    const matches = await findPossibleDuplicateQuestions(
      "[vitest-dup] Một câu hỏi hoàn toàn không tồn tại trong hệ thống, chắc chắn 100%.",
    );
    expect(matches).toHaveLength(0);
  });

  it("không tính câu hỏi đã ARCHIVED là trùng lặp", async () => {
    const question = await prisma.question.create({
      data: {
        content: "[vitest-dup] Câu hỏi đã lưu trữ, không nên tính là trùng lặp đang hoạt động.",
        type: "SHORT_ANSWER",
        difficulty: "EASY",
        subjectId,
        topicId,
        status: "ARCHIVED",
        correctAnswerText: "x",
      },
    });
    createdQuestionIds.push(question.id);

    const matches = await findPossibleDuplicateQuestions(
      "[vitest-dup] Câu hỏi đã lưu trữ, không nên tính là trùng lặp đang hoạt động.",
    );
    expect(matches.some((m) => m.id === question.id)).toBe(false);
  });
});
