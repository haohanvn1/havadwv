import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { BASE_URL, startTestServer, stopTestServer } from "../support/server";
import { getAdminCookie, getStudentCookie } from "../support/tokens";

// Test HTTP đầy đủ cho Phase 8 (Blueprint CRUD, preview, generate, publish) —
// chạy trên database dev thật qua server thật, tự tạo Topic/Question/
// Blueprint/Exam riêng (prefix "[vitest-http-gen]") và dọn sạch sau khi chạy.

let adminCookie: string;
let studentCookie: string;
let subjectId: string;
const createdTopicIds: string[] = [];
const createdQuestionIds: string[] = [];
const createdBlueprintIds: string[] = [];
const createdExamIds: string[] = [];

async function api(path: string, cookie: string, init?: RequestInit) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", cookie, ...(init?.headers ?? {}) },
  });
}

async function makeTopic(name: string) {
  const topic = await prisma.topic.create({
    data: {
      subjectId,
      name,
      slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    },
  });
  createdTopicIds.push(topic.id);
  return topic;
}

async function makeQuestions(topicId: string, count: number) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const q = await prisma.question.create({
      data: {
        content: `[vitest-http-gen] Câu ${topicId}-${i}`,
        type: "SINGLE_CHOICE",
        difficulty: "EASY",
        subjectId,
        topicId,
        status: "ACTIVE",
        options: {
          create: [
            { label: "A", content: "A", isCorrect: true, order: 0 },
            { label: "B", content: "B", isCorrect: false, order: 1 },
          ],
        },
      },
    });
    ids.push(q.id);
    createdQuestionIds.push(q.id);
  }
  return ids;
}

function blueprintPayload(topicId: string, quantity: number) {
  return {
    name: `[vitest-http-gen] Blueprint ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    examType: "TEST",
    durationMinutes: 45,
    sections: [{ name: "Section 1", rules: [{ topicId, quantity }] }],
  };
}

beforeAll(async () => {
  await startTestServer();
  adminCookie = await getAdminCookie();
  studentCookie = await getStudentCookie();
  const toan = await prisma.subject.findUniqueOrThrow({ where: { slug: "toan" } });
  subjectId = toan.id;
}, 70_000);

afterAll(async () => {
  if (createdExamIds.length > 0) {
    await prisma.exam.deleteMany({ where: { id: { in: createdExamIds } } });
  }
  if (createdBlueprintIds.length > 0) {
    await prisma.exam.deleteMany({ where: { generatedFromBlueprintId: { in: createdBlueprintIds } } });
    await prisma.examGenerationJob.deleteMany({ where: { blueprintId: { in: createdBlueprintIds } } });
    await prisma.examBlueprint.deleteMany({ where: { id: { in: createdBlueprintIds } } });
  }
  if (createdQuestionIds.length > 0) {
    await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
  }
  if (createdTopicIds.length > 0) {
    await prisma.topic.deleteMany({ where: { id: { in: createdTopicIds } } });
  }
  stopTestServer();
  await prisma.$disconnect();
});

describe("Authorization", () => {
  it("GET /api/admin/exam-blueprints — chưa đăng nhập → 401", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/exam-blueprints`);
    expect(res.status).toBe(401);
  });

  it("GET /api/admin/exam-blueprints — STUDENT → 403", async () => {
    const res = await api("/api/admin/exam-blueprints", studentCookie);
    expect(res.status).toBe(403);
  });

  it("GET /api/admin/exam-blueprints — ADMIN → 200", async () => {
    const res = await api("/api/admin/exam-blueprints", adminCookie);
    expect(res.status).toBe(200);
  });

  it("GET /api/admin/exams — STUDENT → 403, chưa đăng nhập → 401", async () => {
    expect((await api("/api/admin/exams", studentCookie)).status).toBe(403);
    expect((await fetch(`${BASE_URL}/api/admin/exams`)).status).toBe(401);
  });
});

describe("Blueprint CRUD", () => {
  it("create → 201, list → có Blueprint vừa tạo, get → đúng dữ liệu", async () => {
    const topic = await makeTopic("HTTP CRUD");
    const res = await api("/api/admin/exam-blueprints", adminCookie, {
      method: "POST",
      body: JSON.stringify(blueprintPayload(topic.id, 3)),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    createdBlueprintIds.push(body.blueprint.id);
    expect(body.blueprint.totalQuestions).toBe(3);

    const listRes = await api("/api/admin/exam-blueprints", adminCookie);
    const listBody = await listRes.json();
    expect(listBody.blueprints.some((b: { id: string }) => b.id === body.blueprint.id)).toBe(true);

    const getRes = await api(`/api/admin/exam-blueprints/${body.blueprint.id}`, adminCookie);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.blueprint.sections).toHaveLength(1);
  });

  it("create thiếu section → 400 với fieldErrors", async () => {
    const res = await api("/api/admin/exam-blueprints", adminCookie, {
      method: "POST",
      body: JSON.stringify({ name: "X", examType: "T", durationMinutes: 30, sections: [] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fieldErrors).toBeTruthy();
  });

  it("update hợp lệ → 200, đổi tên thành công", async () => {
    const topic = await makeTopic("HTTP Update");
    const createRes = await api("/api/admin/exam-blueprints", adminCookie, {
      method: "POST",
      body: JSON.stringify(blueprintPayload(topic.id, 2)),
    });
    const created = (await createRes.json()).blueprint;
    createdBlueprintIds.push(created.id);

    const updateRes = await api(`/api/admin/exam-blueprints/${created.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({ ...blueprintPayload(topic.id, 2), name: "[vitest-http-gen] Đã đổi tên" }),
    });
    expect(updateRes.status).toBe(200);
    expect((await updateRes.json()).blueprint.name).toBe("[vitest-http-gen] Đã đổi tên");
  });

  it("update với quantity không hợp lệ → 400", async () => {
    const topic = await makeTopic("HTTP Invalid Update");
    const createRes = await api("/api/admin/exam-blueprints", adminCookie, {
      method: "POST",
      body: JSON.stringify(blueprintPayload(topic.id, 2)),
    });
    const created = (await createRes.json()).blueprint;
    createdBlueprintIds.push(created.id);

    const updateRes = await api(`/api/admin/exam-blueprints/${created.id}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify(blueprintPayload(topic.id, 0)),
    });
    expect(updateRes.status).toBe(400);
  });

  it("STUDENT không thể create/update/delete → 403", async () => {
    const topic = await makeTopic("HTTP Student Blocked");
    expect(
      (
        await api("/api/admin/exam-blueprints", studentCookie, {
          method: "POST",
          body: JSON.stringify(blueprintPayload(topic.id, 1)),
        })
      ).status,
    ).toBe(403);
  });

  it("activate rồi archive → status đổi đúng", async () => {
    const topic = await makeTopic("HTTP Activate Archive");
    const createRes = await api("/api/admin/exam-blueprints", adminCookie, {
      method: "POST",
      body: JSON.stringify(blueprintPayload(topic.id, 1)),
    });
    const created = (await createRes.json()).blueprint;
    createdBlueprintIds.push(created.id);

    const activateRes = await api(`/api/admin/exam-blueprints/${created.id}/activate`, adminCookie, {
      method: "POST",
    });
    expect((await activateRes.json()).blueprint.status).toBe("APPROVED");

    const archiveRes = await api(`/api/admin/exam-blueprints/${created.id}/archive`, adminCookie, {
      method: "POST",
    });
    expect((await archiveRes.json()).blueprint.status).toBe("ARCHIVED");
  });

  it("delete Blueprint chưa dùng → 204", async () => {
    const topic = await makeTopic("HTTP Delete");
    const createRes = await api("/api/admin/exam-blueprints", adminCookie, {
      method: "POST",
      body: JSON.stringify(blueprintPayload(topic.id, 1)),
    });
    const created = (await createRes.json()).blueprint;

    const deleteRes = await api(`/api/admin/exam-blueprints/${created.id}`, adminCookie, { method: "DELETE" });
    expect(deleteRes.status).toBe(204);
  });
});

describe("Preview — chỉ đọc, không tạo Exam", () => {
  it("đủ câu → status OK, không tạo Exam nào", async () => {
    const topic = await makeTopic("HTTP Preview OK");
    await makeQuestions(topic.id, 5);
    const createRes = await api("/api/admin/exam-blueprints", adminCookie, {
      method: "POST",
      body: JSON.stringify(blueprintPayload(topic.id, 3)),
    });
    const created = (await createRes.json()).blueprint;
    createdBlueprintIds.push(created.id);

    const beforeExamCount = await prisma.exam.count();
    const previewRes = await api(`/api/admin/exam-blueprints/${created.id}/preview`, adminCookie, {
      method: "POST",
    });
    expect(previewRes.status).toBe(200);
    const preview = (await previewRes.json()).preview;
    expect(preview.hasShortage).toBe(false);
    expect(preview.sections[0].rules[0].status).toBe("OK");
    const afterExamCount = await prisma.exam.count();
    expect(afterExamCount).toBe(beforeExamCount);
  });

  it("thiếu câu → status THIEU, vẫn không tạo Exam", async () => {
    const topic = await makeTopic("HTTP Preview Shortage");
    await makeQuestions(topic.id, 1);
    const createRes = await api("/api/admin/exam-blueprints", adminCookie, {
      method: "POST",
      body: JSON.stringify(blueprintPayload(topic.id, 5)),
    });
    const created = (await createRes.json()).blueprint;
    createdBlueprintIds.push(created.id);

    const previewRes = await api(`/api/admin/exam-blueprints/${created.id}/preview`, adminCookie, {
      method: "POST",
    });
    const preview = (await previewRes.json()).preview;
    expect(preview.hasShortage).toBe(true);
    expect(preview.sections[0].rules[0].status).toBe("THIEU");
  });
});

describe("Generate", () => {
  it("đủ câu → 201, tạo đúng Exam, GET generation job trả đúng trạng thái", async () => {
    const topic = await makeTopic("HTTP Generate OK");
    await makeQuestions(topic.id, 4);
    const createRes = await api("/api/admin/exam-blueprints", adminCookie, {
      method: "POST",
      body: JSON.stringify(blueprintPayload(topic.id, 3)),
    });
    const created = (await createRes.json()).blueprint;
    createdBlueprintIds.push(created.id);

    const genRes = await api(`/api/admin/exam-blueprints/${created.id}/generate`, adminCookie, { method: "POST" });
    expect(genRes.status).toBe(201);
    const genBody = await genRes.json();
    createdExamIds.push(genBody.examId);

    const jobRes = await api(`/api/admin/exam-generation-jobs/${genBody.jobId}`, adminCookie);
    expect(jobRes.status).toBe(200);
    const job = (await jobRes.json()).job;
    expect(job.status).toBe("CONFIRMED");
    expect(job.items[0].resultingExam.id).toBe(genBody.examId);
  });

  it("thiếu câu → 422 kèm ruleResults chi tiết, không tạo Exam", async () => {
    const topic = await makeTopic("HTTP Generate Insufficient");
    await makeQuestions(topic.id, 1);
    const createRes = await api("/api/admin/exam-blueprints", adminCookie, {
      method: "POST",
      body: JSON.stringify(blueprintPayload(topic.id, 4)),
    });
    const created = (await createRes.json()).blueprint;
    createdBlueprintIds.push(created.id);

    const beforeExamCount = await prisma.exam.count({ where: { generatedFromBlueprintId: created.id } });
    const genRes = await api(`/api/admin/exam-blueprints/${created.id}/generate`, adminCookie, { method: "POST" });
    expect(genRes.status).toBe(422);
    const body = await genRes.json();
    expect(body.ruleResults[0].missing).toBe(3);
    const afterExamCount = await prisma.exam.count({ where: { generatedFromBlueprintId: created.id } });
    expect(afterExamCount).toBe(beforeExamCount);
  });

  it("Blueprint đã ARCHIVED → 409", async () => {
    const topic = await makeTopic("HTTP Generate Archived");
    await makeQuestions(topic.id, 3);
    const createRes = await api("/api/admin/exam-blueprints", adminCookie, {
      method: "POST",
      body: JSON.stringify(blueprintPayload(topic.id, 2)),
    });
    const created = (await createRes.json()).blueprint;
    createdBlueprintIds.push(created.id);
    await api(`/api/admin/exam-blueprints/${created.id}/archive`, adminCookie, { method: "POST" });

    const genRes = await api(`/api/admin/exam-blueprints/${created.id}/generate`, adminCookie, { method: "POST" });
    expect(genRes.status).toBe(409);
  });

  it("STUDENT không thể generate → 403", async () => {
    const topic = await makeTopic("HTTP Generate Student Blocked");
    await makeQuestions(topic.id, 3);
    const createRes = await api("/api/admin/exam-blueprints", adminCookie, {
      method: "POST",
      body: JSON.stringify(blueprintPayload(topic.id, 2)),
    });
    const created = (await createRes.json()).blueprint;
    createdBlueprintIds.push(created.id);

    const res = await api(`/api/admin/exam-blueprints/${created.id}/generate`, studentCookie, { method: "POST" });
    expect(res.status).toBe(403);
  });
});

describe("Publish", () => {
  it("đề DRAFT hợp lệ → publish thành công, publish lần 2 → 409", async () => {
    const topic = await makeTopic("HTTP Publish");
    await makeQuestions(topic.id, 2);
    const createRes = await api("/api/admin/exam-blueprints", adminCookie, {
      method: "POST",
      body: JSON.stringify(blueprintPayload(topic.id, 2)),
    });
    const created = (await createRes.json()).blueprint;
    createdBlueprintIds.push(created.id);
    const genRes = await api(`/api/admin/exam-blueprints/${created.id}/generate`, adminCookie, { method: "POST" });
    const { examId } = await genRes.json();
    createdExamIds.push(examId);

    const detailRes = await api(`/api/admin/exams/${examId}`, adminCookie);
    expect(detailRes.status).toBe(200);
    expect((await detailRes.json()).exam.examQuestions).toHaveLength(2);

    const publishRes = await api(`/api/admin/exams/${examId}/publish`, adminCookie, { method: "POST" });
    expect(publishRes.status).toBe(200);
    expect((await publishRes.json()).exam.status).toBe("PUBLISHED");

    const secondPublish = await api(`/api/admin/exams/${examId}/publish`, adminCookie, { method: "POST" });
    expect(secondPublish.status).toBe(409);
  });

  it("STUDENT không thể publish → 403", async () => {
    const topic = await makeTopic("HTTP Publish Student Blocked");
    await makeQuestions(topic.id, 2);
    const createRes = await api("/api/admin/exam-blueprints", adminCookie, {
      method: "POST",
      body: JSON.stringify(blueprintPayload(topic.id, 2)),
    });
    const created = (await createRes.json()).blueprint;
    createdBlueprintIds.push(created.id);
    const genRes = await api(`/api/admin/exam-blueprints/${created.id}/generate`, adminCookie, { method: "POST" });
    const { examId } = await genRes.json();
    createdExamIds.push(examId);

    const res = await api(`/api/admin/exams/${examId}/publish`, studentCookie, { method: "POST" });
    expect(res.status).toBe(403);
  });
});
