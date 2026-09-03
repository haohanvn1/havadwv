import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  InvalidTopicError,
  NoEligibleQuestionsError,
  PracticeNotAvailableError,
  getActivePracticeAttempt,
  previewPracticeAvailability,
  startPracticeAttempt,
} from "@/server/services/practiceAttemptService";
import { grantSubjectAccessToStudent } from "@/server/services/subjectAccessService";
import type { ExamSnapshot } from "@/server/services/examSnapshotService";

// Phase 11 — Practice Mode. Chạy trên database dev thật, tự tạo học
// sinh/topic/question riêng (prefix "[vitest-practice]"), dọn sạch ở
// afterEach/afterAll. Không đụng student1/student2/toan gốc trừ việc đọc.

let toanId: string;
let tienganhId: string;
let daiSoTopicId: string; // topic có sẵn thuộc Toán
let practiceTopicId: string; // topic riêng cho test này, thuộc Toán
let foreignTopicId: string; // topic thuộc Tiếng Anh — dùng để test reject
let grantedStudentId: string;
let ungrantedStudentId: string;

const createdUserIds: string[] = [];
const createdTopicIds: string[] = [];
const createdQuestionIds: string[] = [];
const createdAccessIds: string[] = [];

async function makeStudent(username: string) {
  const user = await prisma.user.create({
    data: { username, passwordHash: "x", role: "STUDENT", fullName: `[vitest-practice] ${username}`, status: "ACTIVE" },
  });
  createdUserIds.push(user.id);
  return user;
}

async function makeQuestion(overrides: {
  topicId: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  type?: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
}) {
  const type = overrides.type ?? "SINGLE_CHOICE";
  const q = await prisma.question.create({
    data: {
      content: `[vitest-practice] Câu ${type} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      difficulty: overrides.difficulty ?? "EASY",
      subjectId: toanId,
      topicId: overrides.topicId,
      status: overrides.status ?? "ACTIVE",
      correctAnswerText: type === "SHORT_ANSWER" ? "42" : null,
      options:
        type === "SHORT_ANSWER"
          ? undefined
          : {
              create: [
                { label: "A", content: "A", isCorrect: true, order: 0 },
                { label: "B", content: "B", isCorrect: false, order: 1 },
              ],
            },
    },
  });
  createdQuestionIds.push(q.id);
  return q;
}

/** Topic riêng cho từng test cần đếm chính xác số câu — tránh tích luỹ câu hỏi giữa các test dùng chung 1 topic. */
async function makeTopic() {
  const topic = await prisma.topic.create({
    data: {
      subjectId: toanId,
      name: "[vitest-practice] Topic riêng",
      slug: `vitest-practice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      order: 97,
    },
  });
  createdTopicIds.push(topic.id);
  return topic;
}

async function cleanupAttempts() {
  if (createdUserIds.length > 0) {
    await prisma.attemptAnswer.deleteMany({ where: { attempt: { studentId: { in: createdUserIds } } } });
    await prisma.attempt.deleteMany({ where: { studentId: { in: createdUserIds } } });
  }
}

beforeAll(async () => {
  const toan = await prisma.subject.findUniqueOrThrow({ where: { slug: "toan" } });
  toanId = toan.id;
  const tienganh = await prisma.subject.findUniqueOrThrow({ where: { slug: "tieng-anh" } });
  tienganhId = tienganh.id;
  const daiSo = await prisma.topic.findFirstOrThrow({ where: { subjectId: toanId } });
  daiSoTopicId = daiSo.id;

  const practiceTopic = await prisma.topic.create({
    data: { subjectId: toanId, name: "[vitest-practice] Chủ đề riêng", slug: `vitest-practice-${Date.now()}`, order: 99 },
  });
  createdTopicIds.push(practiceTopic.id);
  practiceTopicId = practiceTopic.id;

  const foreignTopic = await prisma.topic.findFirstOrThrow({ where: { subjectId: tienganhId } });
  foreignTopicId = foreignTopic.id;

  const granted = await makeStudent(`vitest-practice-granted-${Date.now()}`);
  grantedStudentId = granted.id;
  const access = await grantSubjectAccessToStudent(grantedStudentId, toanId);
  createdAccessIds.push(access.id);

  const ungranted = await makeStudent(`vitest-practice-ungranted-${Date.now()}`);
  ungrantedStudentId = ungranted.id;
});

afterEach(cleanupAttempts);

afterAll(async () => {
  await cleanupAttempts();
  if (createdAccessIds.length > 0) {
    await prisma.subjectAccess.deleteMany({ where: { id: { in: createdAccessIds } } });
  }
  if (createdQuestionIds.length > 0) {
    await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
  }
  if (createdTopicIds.length > 0) {
    await prisma.topic.deleteMany({ where: { id: { in: createdTopicIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

describe("previewPracticeAvailability", () => {
  it("học sinh chưa có SubjectAccess → PracticeNotAvailableError", async () => {
    await expect(
      previewPracticeAvailability(ungrantedStudentId, { subjectId: toanId, topicId: undefined, difficulty: undefined, questionType: undefined }),
    ).rejects.toBeInstanceOf(PracticeNotAvailableError);
  });

  it("Topic không thuộc Subject đã chọn → InvalidTopicError", async () => {
    await expect(
      previewPracticeAvailability(grantedStudentId, {
        subjectId: toanId,
        topicId: foreignTopicId,
        difficulty: undefined,
        questionType: undefined,
      }),
    ).rejects.toBeInstanceOf(InvalidTopicError);
  });

  it("đếm đúng số câu ACTIVE thuộc topic riêng, loại trừ DRAFT/ARCHIVED", async () => {
    await makeQuestion({ topicId: practiceTopicId, status: "ACTIVE" });
    await makeQuestion({ topicId: practiceTopicId, status: "ACTIVE" });
    await makeQuestion({ topicId: practiceTopicId, status: "DRAFT" });
    await makeQuestion({ topicId: practiceTopicId, status: "ARCHIVED" });

    const result = await previewPracticeAvailability(grantedStudentId, {
      subjectId: toanId,
      topicId: practiceTopicId,
      difficulty: undefined,
      questionType: undefined,
    });
    expect(result.eligibleCount).toBe(2);
  });

  it("không tạo Attempt nào (preview thuần)", async () => {
    await makeQuestion({ topicId: practiceTopicId });
    await previewPracticeAvailability(grantedStudentId, {
      subjectId: toanId,
      topicId: practiceTopicId,
      difficulty: undefined,
      questionType: undefined,
    });
    const count = await prisma.attempt.count({ where: { studentId: grantedStudentId, mode: "PRACTICE" } });
    expect(count).toBe(0);
  });
});

describe("startPracticeAttempt", () => {
  it("tạo đúng Attempt: mode=PRACTICE, examId=null, selectionParams đúng, snapshot đúng shape", async () => {
    const topic = await makeTopic();
    const q1 = await makeQuestion({ topicId: topic.id, difficulty: "EASY" });
    const q2 = await makeQuestion({ topicId: topic.id, difficulty: "EASY" });

    const { attempt, resumed } = await startPracticeAttempt(grantedStudentId, {
      subjectId: toanId,
      topicId: topic.id,
      difficulty: "EASY",
      questionType: undefined,
      questionCount: 20,
    });

    expect(resumed).toBe(false);
    expect(attempt.mode).toBe("PRACTICE");
    expect(attempt.examId).toBeNull();
    expect(attempt.status).toBe("IN_PROGRESS");
    expect(attempt.endsAt).toBeNull();

    const params = attempt.selectionParams as Record<string, unknown>;
    expect(params.subjectId).toBe(toanId);
    expect(params.topicId).toBe(topic.id);
    expect(params.difficulty).toBe("EASY");
    expect(params.questionCount).toBe(20);
    expect("questionType" in params).toBe(false); // không lưu field không dùng

    const snapshot = attempt.examSnapshot as unknown as ExamSnapshot;
    expect(snapshot.examId).toBe("");
    expect(snapshot.questions).toHaveLength(2); // chỉ có 2 câu phù hợp dù xin 20
    const ids = snapshot.questions.map((q) => q.questionId).sort();
    expect(ids).toEqual([q1.id, q2.id].sort());
    // Đáp án đúng CÓ trong snapshot lưu server-side (không sanitize ở đây).
    expect(snapshot.questions[0].options.some((o) => o.isCorrect)).toBe(true);
  });

  it("không chọn trùng câu hỏi trong cùng 1 snapshot", async () => {
    const topic = await makeTopic();
    for (let i = 0; i < 8; i++) await makeQuestion({ topicId: topic.id });

    const { attempt } = await startPracticeAttempt(grantedStudentId, {
      subjectId: toanId,
      topicId: topic.id,
      difficulty: undefined,
      questionType: undefined,
      questionCount: 10,
    });
    const snapshot = attempt.examSnapshot as unknown as ExamSnapshot;
    const ids = snapshot.questions.map((q) => q.questionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("không đủ câu hỏi phù hợp → tạo Attempt với đúng số câu THỰC CÓ, không silently thiếu mà không báo", async () => {
    const topic = await makeTopic();
    await makeQuestion({ topicId: topic.id });
    await makeQuestion({ topicId: topic.id });
    await makeQuestion({ topicId: topic.id });

    const { attempt } = await startPracticeAttempt(grantedStudentId, {
      subjectId: toanId,
      topicId: topic.id,
      difficulty: undefined,
      questionType: undefined,
      questionCount: 20,
    });
    const snapshot = attempt.examSnapshot as unknown as ExamSnapshot;
    expect(snapshot.questions).toHaveLength(3);
    expect(snapshot.questionCount).toBe(3);
  });

  it("không có câu hỏi phù hợp → NoEligibleQuestionsError, không tạo Attempt", async () => {
    await expect(
      startPracticeAttempt(grantedStudentId, {
        subjectId: toanId,
        topicId: practiceTopicId,
        difficulty: "HARD", // không có câu HARD nào trong topic riêng này
        questionType: undefined,
        questionCount: 10,
      }),
    ).rejects.toBeInstanceOf(NoEligibleQuestionsError);

    const count = await prisma.attempt.count({ where: { studentId: grantedStudentId, mode: "PRACTICE" } });
    expect(count).toBe(0);
  });

  it("chưa có SubjectAccess → PracticeNotAvailableError, không tạo Attempt", async () => {
    await makeQuestion({ topicId: practiceTopicId });
    await expect(
      startPracticeAttempt(ungrantedStudentId, {
        subjectId: toanId,
        topicId: practiceTopicId,
        difficulty: undefined,
        questionType: undefined,
        questionCount: 10,
      }),
    ).rejects.toBeInstanceOf(PracticeNotAvailableError);
  });

  it("Topic không thuộc Subject → InvalidTopicError, không tạo Attempt", async () => {
    await expect(
      startPracticeAttempt(grantedStudentId, {
        subjectId: toanId,
        topicId: foreignTopicId,
        difficulty: undefined,
        questionType: undefined,
        questionCount: 10,
      }),
    ).rejects.toBeInstanceOf(InvalidTopicError);
  });

  it("đã có 1 Practice Attempt IN_PROGRESS → gọi start lại (dù điều kiện khác) trả về đúng Attempt cũ (resumed=true), không tạo Attempt mới", async () => {
    await makeQuestion({ topicId: practiceTopicId });
    await makeQuestion({ topicId: daiSoTopicId });

    const first = await startPracticeAttempt(grantedStudentId, {
      subjectId: toanId,
      topicId: practiceTopicId,
      difficulty: undefined,
      questionType: undefined,
      questionCount: 10,
    });
    expect(first.resumed).toBe(false);

    const second = await startPracticeAttempt(grantedStudentId, {
      subjectId: toanId,
      topicId: daiSoTopicId, // điều kiện khác hẳn
      difficulty: undefined,
      questionType: undefined,
      questionCount: 10,
    });
    expect(second.resumed).toBe(true);
    expect(second.attempt.id).toBe(first.attempt.id);

    const count = await prisma.attempt.count({ where: { studentId: grantedStudentId, mode: "PRACTICE" } });
    expect(count).toBe(1);
  });

  it("getActivePracticeAttempt trả đúng Attempt đang dở dang, null nếu không có", async () => {
    expect(await getActivePracticeAttempt(grantedStudentId)).toBeNull();
    const topic = await makeTopic();
    await makeQuestion({ topicId: topic.id });
    const { attempt } = await startPracticeAttempt(grantedStudentId, {
      subjectId: toanId,
      topicId: topic.id,
      difficulty: undefined,
      questionType: undefined,
      questionCount: 10,
    });
    const active = await getActivePracticeAttempt(grantedStudentId);
    expect(active?.id).toBe(attempt.id);
    expect(active?.totalQuestions).toBe(1);
    expect(active?.answeredCount).toBe(0);
  });
});

describe("snapshot stability & archived-question exclusion (mục 26/27)", () => {
  it("sửa Question sau khi đã Start → Attempt vẫn hiện đúng nội dung snapshot cũ", async () => {
    const q = await makeQuestion({ topicId: practiceTopicId });
    const { attempt } = await startPracticeAttempt(grantedStudentId, {
      subjectId: toanId,
      topicId: practiceTopicId,
      difficulty: undefined,
      questionType: undefined,
      questionCount: 1,
    });
    const originalContent = (attempt.examSnapshot as unknown as ExamSnapshot).questions[0].content;

    await prisma.question.update({ where: { id: q.id }, data: { content: "[vitest-practice] Đã sửa nội dung" } });

    const fresh = await prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id } });
    const freshSnapshot = fresh.examSnapshot as unknown as ExamSnapshot;
    expect(freshSnapshot.questions[0].content).toBe(originalContent);
    expect(freshSnapshot.questions[0].content).not.toBe("[vitest-practice] Đã sửa nội dung");
  });

  it("Question bị archive sau khi Start → Attempt cũ vẫn dùng bình thường, Practice MỚI không chọn được câu đó nữa", async () => {
    const soloTopic = await prisma.topic.create({
      data: { subjectId: toanId, name: "[vitest-practice] Topic đơn", slug: `vitest-practice-solo-${Date.now()}`, order: 98 },
    });
    createdTopicIds.push(soloTopic.id);
    const q = await makeQuestion({ topicId: soloTopic.id });

    const { attempt: firstAttempt } = await startPracticeAttempt(grantedStudentId, {
      subjectId: toanId,
      topicId: soloTopic.id,
      difficulty: undefined,
      questionType: undefined,
      questionCount: 1,
    });
    await prisma.attempt.update({ where: { id: firstAttempt.id }, data: { status: "ABANDONED" } });

    await prisma.question.update({ where: { id: q.id }, data: { status: "ARCHIVED" } });

    await expect(
      startPracticeAttempt(grantedStudentId, {
        subjectId: toanId,
        topicId: soloTopic.id,
        difficulty: undefined,
        questionType: undefined,
        questionCount: 1,
      }),
    ).rejects.toBeInstanceOf(NoEligibleQuestionsError);

    const stillThere = await prisma.attempt.findUniqueOrThrow({ where: { id: firstAttempt.id } });
    expect((stillThere.examSnapshot as unknown as ExamSnapshot).questions).toHaveLength(1);
  });
});

describe("SubjectAccess bị thu hồi sau khi Start (mục 28)", () => {
  it("Attempt cũ vẫn tiếp tục làm được; Practice MỚI cùng môn bị chặn", async () => {
    const tempStudent = await makeStudent(`vitest-practice-revoke-${Date.now()}`);
    const access = await grantSubjectAccessToStudent(tempStudent.id, toanId);
    createdAccessIds.push(access.id);
    await makeQuestion({ topicId: practiceTopicId });

    const { attempt } = await startPracticeAttempt(tempStudent.id, {
      subjectId: toanId,
      topicId: practiceTopicId,
      difficulty: undefined,
      questionType: undefined,
      questionCount: 1,
    });

    await prisma.subjectAccess.delete({ where: { id: access.id } });
    createdAccessIds.splice(createdAccessIds.indexOf(access.id), 1);

    // Attempt đang có vẫn đọc lại được bình thường (không bị phá).
    const stillThere = await prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(stillThere.status).toBe("IN_PROGRESS");

    // Nhưng phải nộp/huỷ Attempt cũ trước khi thử start mới (giả định 1
    // Practice IN_PROGRESS tại một thời điểm) — huỷ để test đúng riêng phần
    // SubjectAccess, không lẫn với rule "đã có Attempt đang chạy".
    await prisma.attempt.update({ where: { id: attempt.id }, data: { status: "ABANDONED" } });

    await expect(
      startPracticeAttempt(tempStudent.id, {
        subjectId: toanId,
        topicId: practiceTopicId,
        difficulty: undefined,
        questionType: undefined,
        questionCount: 1,
      }),
    ).rejects.toBeInstanceOf(PracticeNotAvailableError);
  });
});
