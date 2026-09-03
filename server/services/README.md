# server/services

Business logic sống ở đây, tách khỏi route/UI. Cả Server Actions lẫn API Routes đều
phải gọi vào service ở thư mục này thay vì viết logic trực tiếp trong `app/`, để
tránh trùng lặp (ví dụ: chấm điểm bài thi chỉ có một chỗ implement duy nhất).

Các service sẽ được thêm dần theo từng phase, ví dụ:

- `examService.ts`, `attemptService.ts` — Phase 10–12
- `blueprintService.ts`, `questionMatchingService.ts`, `examGenerationService.ts` — module sinh đề
- `videoLessonService.ts`, `liveClassService.ts` — module Learning Content

Đã có:

- `questionService.ts` (Phase 6) — CRUD Question Bank.
- `fileStorageService.ts`, `documentParser/`, `questionCandidateDetector.ts`,
  `questionImportService.ts` (Phase 7A) — pipeline import PDF/DOCX → parse →
  tách câu hỏi bằng pattern (KHÔNG AI) → `ImportQuestionDraft`. AI extraction
  thật (nếu có) sẽ là một bước thay thế/bổ sung cho `questionCandidateDetector`
  ở phase sau, không đổi kiến trúc pipeline.
