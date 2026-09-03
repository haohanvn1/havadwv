-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STUDENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "ExamDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'MIXED');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AttemptMode" AS ENUM ('PRACTICE', 'MOCK_EXAM');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BlueprintStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GenerationMode" AS ENUM ('RANDOM', 'SMART_RANDOM', 'MANUAL');

-- CreateEnum
CREATE TYPE "GenerationJobStatus" AS ENUM ('DRAFT', 'PREVIEW', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "GenerationItemStatus" AS ENUM ('PENDING', 'READY', 'INSUFFICIENT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "LiveClassVisibility" AS ENUM ('ALL_STUDENTS', 'SPECIFIC_GROUP', 'SPECIFIC_STUDENTS');

-- CreateEnum
CREATE TYPE "LiveClassStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "class" TEXT,
    "school" TEXT,
    "targetExamType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "type" "QuestionType" NOT NULL,
    "correctAnswerText" TEXT,
    "difficulty" "Difficulty" NOT NULL,
    "subjectId" UUID NOT NULL,
    "topicId" UUID NOT NULL,
    "source" TEXT,
    "year" INTEGER,
    "hint" TEXT,
    "explanation" TEXT,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cognitiveLevel" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "subjectId" UUID,
    "durationMinutes" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER,
    "difficulty" "ExamDifficulty" NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "generatedFromBlueprintId" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "examId" UUID,
    "mode" "AttemptMode" NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "selectionParams" JSONB,
    "examSnapshot" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" DOUBLE PRECISION,
    "correctCount" INTEGER,
    "wrongCount" INTEGER,
    "unansweredCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptAnswer" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "questionId" UUID,
    "selectedOptionIds" JSONB NOT NULL DEFAULT '[]',
    "answerText" TEXT,
    "isCorrect" BOOLEAN,
    "hintUsed" BOOLEAN NOT NULL DEFAULT false,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "changeCount" INTEGER NOT NULL DEFAULT 0,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttemptAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoLesson" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subjectId" UUID NOT NULL,
    "topicId" UUID,
    "teacherId" UUID,
    "youtubeUrl" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "grade" TEXT,
    "examType" TEXT,
    "durationSeconds" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "LessonStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentVideoProgress" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "videoLessonId" UUID NOT NULL,
    "progressSeconds" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "lastWatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentVideoProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedFile" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" UUID NOT NULL,
    "examId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" UUID NOT NULL,
    "importedFileId" UUID NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "totalExtracted" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportQuestionDraft" (
    "id" UUID NOT NULL,
    "importJobId" UUID NOT NULL,
    "rawText" TEXT NOT NULL,
    "parsedContent" JSONB NOT NULL,
    "suggestedSubjectId" UUID,
    "suggestedTopicId" UUID,
    "suggestedDifficulty" "Difficulty",
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "approvedQuestionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportQuestionDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlueprintImport" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" UUID NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "rawExtractedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BlueprintImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlueprintImportDraft" (
    "id" UUID NOT NULL,
    "blueprintImportId" UUID NOT NULL,
    "parsedName" TEXT,
    "parsedExamType" TEXT,
    "parsedSubjectId" UUID,
    "parsedTotalQuestions" INTEGER,
    "parsedDurationMinutes" INTEGER,
    "parsedStructure" JSONB NOT NULL,
    "validationErrors" JSONB,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "approvedBlueprintId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlueprintImportDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamBlueprint" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "subjectId" UUID,
    "totalQuestions" INTEGER NOT NULL,
    "durationMinutes" INTEGER,
    "status" "BlueprintStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamBlueprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlueprintSection" (
    "id" UUID NOT NULL,
    "blueprintId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlueprintSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlueprintRule" (
    "id" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "subjectId" UUID,
    "topicId" UUID,
    "difficulty" "Difficulty",
    "questionType" "QuestionType",
    "cognitiveLevel" TEXT,
    "year" INTEGER,
    "source" TEXT,
    "requiredTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quantity" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "BlueprintRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamGenerationJob" (
    "id" UUID NOT NULL,
    "blueprintId" UUID NOT NULL,
    "mode" "GenerationMode" NOT NULL,
    "requestedExamCount" INTEGER NOT NULL DEFAULT 1,
    "ruleOverrides" JSONB,
    "status" "GenerationJobStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "ExamGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamGenerationItem" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "status" "GenerationItemStatus" NOT NULL DEFAULT 'PENDING',
    "selectedQuestions" JSONB NOT NULL DEFAULT '[]',
    "distributionSummary" JSONB,
    "resultingExamId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamGenerationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGroup" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGroupMember" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveClass" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subjectId" UUID,
    "topicId" UUID,
    "teacherId" UUID,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "joinBeforeMinutes" INTEGER NOT NULL DEFAULT 15,
    "zoomJoinUrl" TEXT NOT NULL,
    "zoomMeetingId" TEXT,
    "zoomPassword" TEXT,
    "visibility" "LiveClassVisibility" NOT NULL DEFAULT 'ALL_STUDENTS',
    "status" "LiveClassStatus" NOT NULL DEFAULT 'DRAFT',
    "cancelReason" TEXT,
    "meetingProvider" TEXT NOT NULL DEFAULT 'MANUAL',
    "externalMeetingRef" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveClassAccess" (
    "id" UUID NOT NULL,
    "liveClassId" UUID NOT NULL,
    "studentGroupId" UUID,
    "studentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveClassAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveClassParticipant" (
    "id" UUID NOT NULL,
    "liveClassId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveClassParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveClassRecording" (
    "id" UUID NOT NULL,
    "liveClassId" UUID NOT NULL,
    "youtubeUrl" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "addedById" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveClassRecording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_slug_key" ON "Subject"("slug");

-- CreateIndex
CREATE INDEX "Topic_subjectId_idx" ON "Topic"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_subjectId_slug_key" ON "Topic"("subjectId", "slug");

-- CreateIndex
CREATE INDEX "Question_subjectId_idx" ON "Question"("subjectId");

-- CreateIndex
CREATE INDEX "Question_topicId_difficulty_idx" ON "Question"("topicId", "difficulty");

-- CreateIndex
CREATE INDEX "Question_status_idx" ON "Question"("status");

-- CreateIndex
CREATE INDEX "QuestionOption_questionId_idx" ON "QuestionOption"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_label_key" ON "QuestionOption"("questionId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Exam_code_key" ON "Exam"("code");

-- CreateIndex
CREATE INDEX "Exam_status_idx" ON "Exam"("status");

-- CreateIndex
CREATE INDEX "Exam_subjectId_examType_idx" ON "Exam"("subjectId", "examType");

-- CreateIndex
CREATE INDEX "ExamQuestion_questionId_idx" ON "ExamQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestion_examId_questionId_key" ON "ExamQuestion"("examId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestion_examId_order_key" ON "ExamQuestion"("examId", "order");

-- CreateIndex
CREATE INDEX "Attempt_studentId_status_idx" ON "Attempt"("studentId", "status");

-- CreateIndex
CREATE INDEX "Attempt_examId_idx" ON "Attempt"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_studentId_examId_attemptNumber_key" ON "Attempt"("studentId", "examId", "attemptNumber");

-- CreateIndex
CREATE INDEX "AttemptAnswer_questionId_idx" ON "AttemptAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptAnswer_attemptId_questionId_key" ON "AttemptAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "VideoLesson_subjectId_idx" ON "VideoLesson"("subjectId");

-- CreateIndex
CREATE INDEX "VideoLesson_topicId_idx" ON "VideoLesson"("topicId");

-- CreateIndex
CREATE INDEX "VideoLesson_status_idx" ON "VideoLesson"("status");

-- CreateIndex
CREATE INDEX "StudentVideoProgress_studentId_idx" ON "StudentVideoProgress"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentVideoProgress_studentId_videoLessonId_key" ON "StudentVideoProgress"("studentId", "videoLessonId");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportJob_importedFileId_idx" ON "ImportJob"("importedFileId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportQuestionDraft_approvedQuestionId_key" ON "ImportQuestionDraft"("approvedQuestionId");

-- CreateIndex
CREATE INDEX "ImportQuestionDraft_status_importJobId_idx" ON "ImportQuestionDraft"("status", "importJobId");

-- CreateIndex
CREATE UNIQUE INDEX "BlueprintImportDraft_blueprintImportId_key" ON "BlueprintImportDraft"("blueprintImportId");

-- CreateIndex
CREATE UNIQUE INDEX "BlueprintImportDraft_approvedBlueprintId_key" ON "BlueprintImportDraft"("approvedBlueprintId");

-- CreateIndex
CREATE UNIQUE INDEX "BlueprintSection_blueprintId_order_key" ON "BlueprintSection"("blueprintId", "order");

-- CreateIndex
CREATE INDEX "BlueprintRule_sectionId_idx" ON "BlueprintRule"("sectionId");

-- CreateIndex
CREATE INDEX "BlueprintRule_topicId_difficulty_idx" ON "BlueprintRule"("topicId", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "ExamGenerationItem_resultingExamId_key" ON "ExamGenerationItem"("resultingExamId");

-- CreateIndex
CREATE INDEX "ExamGenerationItem_jobId_status_idx" ON "ExamGenerationItem"("jobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExamGenerationItem_jobId_sequenceNumber_key" ON "ExamGenerationItem"("jobId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "StudentGroupMember_studentId_idx" ON "StudentGroupMember"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGroupMember_groupId_studentId_key" ON "StudentGroupMember"("groupId", "studentId");

-- CreateIndex
CREATE INDEX "LiveClass_status_startTime_idx" ON "LiveClass"("status", "startTime");

-- CreateIndex
CREATE INDEX "LiveClassAccess_liveClassId_idx" ON "LiveClassAccess"("liveClassId");

-- CreateIndex
CREATE INDEX "LiveClassAccess_studentGroupId_idx" ON "LiveClassAccess"("studentGroupId");

-- CreateIndex
CREATE INDEX "LiveClassAccess_studentId_idx" ON "LiveClassAccess"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveClassParticipant_liveClassId_studentId_key" ON "LiveClassParticipant"("liveClassId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveClassRecording_liveClassId_key" ON "LiveClassRecording"("liveClassId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_generatedFromBlueprintId_fkey" FOREIGN KEY ("generatedFromBlueprintId") REFERENCES "ExamBlueprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoLesson" ADD CONSTRAINT "VideoLesson_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoLesson" ADD CONSTRAINT "VideoLesson_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoLesson" ADD CONSTRAINT "VideoLesson_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoLesson" ADD CONSTRAINT "VideoLesson_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentVideoProgress" ADD CONSTRAINT "StudentVideoProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentVideoProgress" ADD CONSTRAINT "StudentVideoProgress_videoLessonId_fkey" FOREIGN KEY ("videoLessonId") REFERENCES "VideoLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedFile" ADD CONSTRAINT "ImportedFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedFile" ADD CONSTRAINT "ImportedFile_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_importedFileId_fkey" FOREIGN KEY ("importedFileId") REFERENCES "ImportedFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportQuestionDraft" ADD CONSTRAINT "ImportQuestionDraft_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportQuestionDraft" ADD CONSTRAINT "ImportQuestionDraft_suggestedSubjectId_fkey" FOREIGN KEY ("suggestedSubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportQuestionDraft" ADD CONSTRAINT "ImportQuestionDraft_suggestedTopicId_fkey" FOREIGN KEY ("suggestedTopicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportQuestionDraft" ADD CONSTRAINT "ImportQuestionDraft_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportQuestionDraft" ADD CONSTRAINT "ImportQuestionDraft_approvedQuestionId_fkey" FOREIGN KEY ("approvedQuestionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintImport" ADD CONSTRAINT "BlueprintImport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintImportDraft" ADD CONSTRAINT "BlueprintImportDraft_blueprintImportId_fkey" FOREIGN KEY ("blueprintImportId") REFERENCES "BlueprintImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintImportDraft" ADD CONSTRAINT "BlueprintImportDraft_parsedSubjectId_fkey" FOREIGN KEY ("parsedSubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintImportDraft" ADD CONSTRAINT "BlueprintImportDraft_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintImportDraft" ADD CONSTRAINT "BlueprintImportDraft_approvedBlueprintId_fkey" FOREIGN KEY ("approvedBlueprintId") REFERENCES "ExamBlueprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamBlueprint" ADD CONSTRAINT "ExamBlueprint_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamBlueprint" ADD CONSTRAINT "ExamBlueprint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintSection" ADD CONSTRAINT "BlueprintSection_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ExamBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintRule" ADD CONSTRAINT "BlueprintRule_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BlueprintSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintRule" ADD CONSTRAINT "BlueprintRule_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintRule" ADD CONSTRAINT "BlueprintRule_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamGenerationJob" ADD CONSTRAINT "ExamGenerationJob_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ExamBlueprint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamGenerationJob" ADD CONSTRAINT "ExamGenerationJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamGenerationItem" ADD CONSTRAINT "ExamGenerationItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ExamGenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamGenerationItem" ADD CONSTRAINT "ExamGenerationItem_resultingExamId_fkey" FOREIGN KEY ("resultingExamId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGroupMember" ADD CONSTRAINT "StudentGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGroupMember" ADD CONSTRAINT "StudentGroupMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassAccess" ADD CONSTRAINT "LiveClassAccess_liveClassId_fkey" FOREIGN KEY ("liveClassId") REFERENCES "LiveClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassAccess" ADD CONSTRAINT "LiveClassAccess_studentGroupId_fkey" FOREIGN KEY ("studentGroupId") REFERENCES "StudentGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassAccess" ADD CONSTRAINT "LiveClassAccess_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassParticipant" ADD CONSTRAINT "LiveClassParticipant_liveClassId_fkey" FOREIGN KEY ("liveClassId") REFERENCES "LiveClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassParticipant" ADD CONSTRAINT "LiveClassParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassRecording" ADD CONSTRAINT "LiveClassRecording_liveClassId_fkey" FOREIGN KEY ("liveClassId") REFERENCES "LiveClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassRecording" ADD CONSTRAINT "LiveClassRecording_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint
-- Đúng một trong hai cột studentGroupId/studentId phải có giá trị — Prisma
-- schema chưa hỗ trợ khai báo CHECK constraint dạng này trực tiếp nên thêm
-- thủ công ở đây (xem ghi chú trên model LiveClassAccess trong schema.prisma).
ALTER TABLE "LiveClassAccess" ADD CONSTRAINT "LiveClassAccess_exactly_one_target" CHECK (
  (num_nonnulls("studentGroupId", "studentId") = 1)
);
