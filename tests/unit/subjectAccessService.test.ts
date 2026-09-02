import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getAccessibleSubjectIds,
  getAccessibleSubjects,
  grantSubjectAccessToGroup,
  grantSubjectAccessToStudent,
  hasSubjectAccess,
} from "@/server/services/subjectAccessService";
import {
  ExamNotAvailableError,
  getExamAvailabilityForStudent,
  listAvailableExamsForStudent,
  listExamsForSubject,
} from "@/server/services/studentAttemptService";

// Phase 10 — cấp quyền theo Subject cho "Lớp"/"Bộ đề". Test chạy trên
// database dev thật, tự tạo học sinh/subject/exam riêng (prefix
// "[vitest-subjaccess]"), dọn sạch ở afterAll.

let ungrantedStudentId: string;
let grantedStudentId: string;
let groupMemberStudentId: string;
let toanId: string;
const createdUserIds: string[] = [];
const createdExamIds: string[] = [];
const createdGroupIds: string[] = [];
const createdAccessIds: string[] = [];

async function makeStudent(username: string) {
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: "x",
      role: "STUDENT",
      fullName: `[vitest-subjaccess] ${username}`,
      status: "ACTIVE",
    },
  });
  createdUserIds.push(user.id);
  return user;
}

beforeAll(async () => {
  const toan = await prisma.subject.findUniqueOrThrow({ where: { slug: "toan" } });
  toanId = toan.id;

  const ungranted = await makeStudent(`vitest-subjaccess-ungranted-${Date.now()}`);
  ungrantedStudentId = ungranted.id;

  const granted = await makeStudent(`vitest-subjaccess-granted-${Date.now()}`);
  grantedStudentId = granted.id;
  const access = await grantSubjectAccessToStudent(grantedStudentId, toanId);
  createdAccessIds.push(access.id);

  const groupMember = await makeStudent(`vitest-subjaccess-groupmember-${Date.now()}`);
  groupMemberStudentId = groupMember.id;
  const group = await prisma.studentGroup.create({ data: { name: "[vitest-subjaccess] Nhóm test" } });
  createdGroupIds.push(group.id);
  await prisma.studentGroupMember.create({ data: { groupId: group.id, studentId: groupMemberStudentId } });
  const groupAccess = await grantSubjectAccessToGroup(group.id, toanId);
  createdAccessIds.push(groupAccess.id);
});

afterAll(async () => {
  if (createdExamIds.length > 0) {
    await prisma.exam.deleteMany({ where: { id: { in: createdExamIds } } });
  }
  if (createdAccessIds.length > 0) {
    await prisma.subjectAccess.deleteMany({ where: { id: { in: createdAccessIds } } });
  }
  if (createdGroupIds.length > 0) {
    await prisma.studentGroupMember.deleteMany({ where: { groupId: { in: createdGroupIds } } });
    await prisma.studentGroup.deleteMany({ where: { id: { in: createdGroupIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

describe("hasSubjectAccess / getAccessibleSubjectIds", () => {
  it("cấp trực tiếp cho student → có quyền", async () => {
    expect(await hasSubjectAccess(grantedStudentId, toanId)).toBe(true);
    expect(await getAccessibleSubjectIds(grantedStudentId)).toContain(toanId);
  });

  it("cấp qua StudentGroup → thành viên nhóm có quyền", async () => {
    expect(await hasSubjectAccess(groupMemberStudentId, toanId)).toBe(true);
  });

  it("chưa được cấp quyền → không có quyền", async () => {
    expect(await hasSubjectAccess(ungrantedStudentId, toanId)).toBe(false);
    expect(await getAccessibleSubjectIds(ungrantedStudentId)).not.toContain(toanId);
  });

  it("getAccessibleSubjects trả về đúng subject đã cấp, kèm số lượng nội dung", async () => {
    const subjects = await getAccessibleSubjects(grantedStudentId);
    const toan = subjects.find((s) => s.id === toanId);
    expect(toan).toBeDefined();
    expect(typeof toan!.videoLessonCount).toBe("number");
    expect(typeof toan!.examCount).toBe("number");
  });
});

describe("Lọc quyền theo Subject trong luồng Exam của Student", () => {
  it("Exam có subjectId, học sinh CHƯA có quyền → không xuất hiện trong danh sách, chi tiết trả null", async () => {
    const exam = await prisma.exam.create({
      data: {
        title: "[vitest-subjaccess] Exam có subject",
        code: `VT-SUBJACCESS-${Date.now()}`,
        examType: "TEST",
        subjectId: toanId,
        durationMinutes: 30,
        questionCount: 0,
        difficulty: "MIXED",
        status: "PUBLISHED",
      },
    });
    createdExamIds.push(exam.id);

    const list = await listAvailableExamsForStudent(ungrantedStudentId);
    expect(list.some((e) => e.id === exam.id)).toBe(false);

    const detail = await getExamAvailabilityForStudent(ungrantedStudentId, exam.id);
    expect(detail).toBeNull();
  });

  it("Exam có subjectId, học sinh ĐÃ có quyền → xuất hiện trong danh sách + chi tiết", async () => {
    const exam = await prisma.exam.create({
      data: {
        title: "[vitest-subjaccess] Exam có subject 2",
        code: `VT-SUBJACCESS-${Date.now()}-2`,
        examType: "TEST",
        subjectId: toanId,
        durationMinutes: 30,
        questionCount: 0,
        difficulty: "MIXED",
        status: "PUBLISHED",
      },
    });
    createdExamIds.push(exam.id);

    const list = await listAvailableExamsForStudent(grantedStudentId);
    expect(list.some((e) => e.id === exam.id)).toBe(true);

    const detail = await getExamAvailabilityForStudent(grantedStudentId, exam.id);
    expect(detail).not.toBeNull();
  });

  it("Exam không gắn subjectId (null) → hiển thị công khai cho mọi học sinh", async () => {
    const exam = await prisma.exam.create({
      data: {
        title: "[vitest-subjaccess] Exam không gắn môn",
        code: `VT-SUBJACCESS-${Date.now()}-3`,
        examType: "TEST",
        subjectId: null,
        durationMinutes: 30,
        questionCount: 0,
        difficulty: "MIXED",
        status: "PUBLISHED",
      },
    });
    createdExamIds.push(exam.id);

    const list = await listAvailableExamsForStudent(ungrantedStudentId);
    expect(list.some((e) => e.id === exam.id)).toBe(true);
  });

  it("listExamsForSubject → ném ExamNotAvailableError nếu học sinh chưa có quyền vào subject đó", async () => {
    await expect(listExamsForSubject(ungrantedStudentId, toanId)).rejects.toBeInstanceOf(ExamNotAvailableError);
    await expect(listExamsForSubject(grantedStudentId, toanId)).resolves.toBeInstanceOf(Array);
  });
});
