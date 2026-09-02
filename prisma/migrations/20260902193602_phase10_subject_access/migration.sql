-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SubjectAccess" (
    "id" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "studentGroupId" UUID,
    "studentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterColumnMapping" (
    "id" UUID NOT NULL,
    "headerText" TEXT NOT NULL,
    "subjectId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterColumnMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubjectAccess_subjectId_idx" ON "SubjectAccess"("subjectId");

-- CreateIndex
CREATE INDEX "SubjectAccess_studentGroupId_idx" ON "SubjectAccess"("studentGroupId");

-- CreateIndex
CREATE INDEX "SubjectAccess_studentId_idx" ON "SubjectAccess"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterColumnMapping_headerText_key" ON "RosterColumnMapping"("headerText");

-- AddForeignKey
ALTER TABLE "SubjectAccess" ADD CONSTRAINT "SubjectAccess_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectAccess" ADD CONSTRAINT "SubjectAccess_studentGroupId_fkey" FOREIGN KEY ("studentGroupId") REFERENCES "StudentGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectAccess" ADD CONSTRAINT "SubjectAccess_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterColumnMapping" ADD CONSTRAINT "RosterColumnMapping_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Đúng một trong hai cột studentGroupId/studentId có giá trị — Prisma
-- schema chưa hỗ trợ khai báo CHECK constraint dạng này trực tiếp nên thêm
-- thủ công ở đây (xem ghi chú trên model SubjectAccess trong schema.prisma,
-- cùng pattern với LiveClassAccess_exactly_one_target).
ALTER TABLE "SubjectAccess" ADD CONSTRAINT "SubjectAccess_exactly_one_target" CHECK (
  (num_nonnulls("studentGroupId", "studentId") = 1)
);
