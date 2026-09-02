import { describe, expect, it } from "vitest";
import { sanitizeSnapshotForStudent, type ExamSnapshot } from "@/server/services/examSnapshotService";

function makeSnapshot(): ExamSnapshot {
  return {
    examId: "exam-1",
    title: "Đề test",
    examType: "TEST",
    durationMinutes: 60,
    questionCount: 1,
    questions: [
      {
        questionId: "q1",
        order: 1,
        type: "SHORT_ANSWER",
        content: "1 + 1 = ?",
        options: [
          { id: "opt-a", label: "A", content: "1", isCorrect: false },
          { id: "opt-b", label: "B", content: "2", isCorrect: true },
        ],
        correctAnswerText: "2",
        points: 2,
      },
    ],
  };
}

describe("sanitizeSnapshotForStudent", () => {
  it("không chứa isCorrect hoặc correctAnswerText ở bất kỳ đâu trong output", () => {
    const client = sanitizeSnapshotForStudent(makeSnapshot());
    const json = JSON.stringify(client);
    expect(json).not.toContain("isCorrect");
    expect(json).not.toContain("correctAnswerText");
  });

  it("vẫn giữ đủ dữ liệu cần để render đề: id, label, content, order, type", () => {
    const client = sanitizeSnapshotForStudent(makeSnapshot());
    expect(client.questions[0]).toEqual({
      questionId: "q1",
      order: 1,
      type: "SHORT_ANSWER",
      content: "1 + 1 = ?",
      options: [
        { id: "opt-a", label: "A", content: "1" },
        { id: "opt-b", label: "B", content: "2" },
      ],
      points: 2,
    });
  });

  it("points thiếu (snapshot cũ trước khi field này tồn tại ở Phase 9B) → mặc định 1", () => {
    const snapshot = makeSnapshot();
    delete snapshot.questions[0].points;
    const client = sanitizeSnapshotForStudent(snapshot);
    expect(client.questions[0].points).toBe(1);
  });
});
