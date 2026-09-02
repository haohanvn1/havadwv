/**
 * Seed data tối thiểu để test — không phải dữ liệu demo đầy đủ.
 * Chạy: `npx prisma db seed` (hoặc tự động sau `prisma migrate dev`).
 */
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function hash(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  // ---------- Users ----------
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: await hash("Admin@123"),
      role: "ADMIN",
      fullName: "Quản trị viên",
      email: "admin@havaedu.local",
      status: "ACTIVE",
    },
  });

  const student1 = await prisma.user.upsert({
    where: { username: "student1" },
    update: {},
    create: {
      username: "student1",
      passwordHash: await hash("Student@123"),
      role: "STUDENT",
      fullName: "Nguyễn Văn A",
      email: "student1@havaedu.local",
      status: "ACTIVE",
      studentProfile: {
        create: { class: "12A1", school: "THPT Chu Văn An" },
      },
    },
  });

  const student2 = await prisma.user.upsert({
    where: { username: "student2" },
    update: {},
    create: {
      username: "student2",
      passwordHash: await hash("Student@123"),
      role: "STUDENT",
      fullName: "Trần Thị B",
      email: "student2@havaedu.local",
      status: "ACTIVE",
      studentProfile: {
        create: { class: "12A2", school: "THPT Chu Văn An" },
      },
    },
  });

  // ---------- Subjects & Topics ----------
  const toan = await prisma.subject.upsert({
    where: { slug: "toan" },
    update: {},
    create: { name: "Toán", slug: "toan", order: 1 },
  });

  const tienganh = await prisma.subject.upsert({
    where: { slug: "tieng-anh" },
    update: {},
    create: { name: "Tiếng Anh", slug: "tieng-anh", order: 2 },
  });

  // ĐGNL/ĐGTD là các kỳ thi tổng hợp, được coi là Subject bình thường (Phase
  // 10) — dùng chung đúng cơ chế Subject → Exam/VideoLesson/SubjectAccess
  // như mọi môn học khác, không cần khái niệm examType riêng ở cấp Subject.
  const dgnl = await prisma.subject.upsert({
    where: { slug: "dgnl" },
    update: {},
    create: { name: "Đánh giá năng lực", slug: "dgnl", order: 3 },
  });

  const dgtd = await prisma.subject.upsert({
    where: { slug: "dgtd" },
    update: {},
    create: { name: "Đánh giá tư duy", slug: "dgtd", order: 4 },
  });

  const daiSo = await prisma.topic.upsert({
    where: { subjectId_slug: { subjectId: toan.id, slug: "dai-so" } },
    update: {},
    create: { subjectId: toan.id, name: "Đại số", slug: "dai-so", order: 1 },
  });

  const hinhHoc = await prisma.topic.upsert({
    where: { subjectId_slug: { subjectId: toan.id, slug: "hinh-hoc" } },
    update: {},
    create: { subjectId: toan.id, name: "Hình học", slug: "hinh-hoc", order: 2 },
  });

  const nguPhap = await prisma.topic.upsert({
    where: { subjectId_slug: { subjectId: tienganh.id, slug: "ngu-phap" } },
    update: {},
    create: { subjectId: tienganh.id, name: "Ngữ pháp", slug: "ngu-phap", order: 1 },
  });

  const tuVung = await prisma.topic.upsert({
    where: { subjectId_slug: { subjectId: tienganh.id, slug: "tu-vung" } },
    update: {},
    create: { subjectId: tienganh.id, name: "Từ vựng", slug: "tu-vung", order: 2 },
  });

  // ---------- Questions ----------
  await prisma.question.create({
    data: {
      content: "Giải phương trình 2x + 3 = 7. Tìm x.",
      type: "SINGLE_CHOICE",
      difficulty: "EASY",
      subjectId: toan.id,
      topicId: daiSo.id,
      status: "ACTIVE",
      createdById: admin.id,
      options: {
        create: [
          { label: "A", content: "1", isCorrect: false, order: 1 },
          { label: "B", content: "2", isCorrect: true, order: 2 },
          { label: "C", content: "3", isCorrect: false, order: 3 },
          { label: "D", content: "4", isCorrect: false, order: 4 },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      content: "Trong các số sau, số nào là ước của 12?",
      type: "MULTIPLE_CHOICE",
      difficulty: "MEDIUM",
      subjectId: toan.id,
      topicId: hinhHoc.id,
      status: "ACTIVE",
      createdById: admin.id,
      options: {
        create: [
          { label: "A", content: "3", isCorrect: true, order: 1 },
          { label: "B", content: "5", isCorrect: false, order: 2 },
          { label: "C", content: "6", isCorrect: true, order: 3 },
          { label: "D", content: "7", isCorrect: false, order: 4 },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      content: "Choose the correct form: She ___ to school every day.",
      type: "SINGLE_CHOICE",
      difficulty: "EASY",
      subjectId: tienganh.id,
      topicId: nguPhap.id,
      status: "ACTIVE",
      createdById: admin.id,
      options: {
        create: [
          { label: "A", content: "go", isCorrect: false, order: 1 },
          { label: "B", content: "goes", isCorrect: true, order: 2 },
          { label: "C", content: "going", isCorrect: false, order: 3 },
          { label: "D", content: "gone", isCorrect: false, order: 4 },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      content: "'Happy' và 'Glad' là hai từ đồng nghĩa.",
      type: "TRUE_FALSE",
      difficulty: "EASY",
      subjectId: tienganh.id,
      topicId: tuVung.id,
      status: "ACTIVE",
      createdById: admin.id,
      options: {
        create: [
          { label: "A", content: "Đúng", isCorrect: true, order: 1 },
          { label: "B", content: "Sai", isCorrect: false, order: 2 },
        ],
      },
    },
  });

  // ---------- Subject access (Phase 10) ----------
  // Cấp quyền "Lớp"/"Bộ đề" mặc định cho 2 học sinh seed vào 2 môn đã seed —
  // bắt buộc phải có, nếu không toàn bộ Exam/VideoLesson gắn subjectId sẽ bị
  // ẩn khỏi 2 tài khoản demo/test này sau khi Phase 10 bật lọc quyền theo
  // Subject (allow-list nghiêm ngặt, không có fallback ngầm).
  for (const student of [student1, student2]) {
    for (const subject of [toan, tienganh]) {
      const existing = await prisma.subjectAccess.findFirst({
        where: { subjectId: subject.id, studentId: student.id },
      });
      if (!existing) {
        await prisma.subjectAccess.create({
          data: { subjectId: subject.id, studentId: student.id },
        });
      }
    }
  }

  console.log("Seed hoàn tất:");
  console.log(`  Admin:    ${admin.username}`);
  console.log(`  Students: ${student1.username}, ${student2.username}`);
  console.log(`  Subjects: ${toan.name}, ${tienganh.name}, ${dgnl.name}, ${dgtd.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
