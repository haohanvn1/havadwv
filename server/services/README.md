# server/services

Business logic sống ở đây, tách khỏi route/UI. Cả Server Actions lẫn API Routes đều
phải gọi vào service ở thư mục này thay vì viết logic trực tiếp trong `app/`, để
tránh trùng lặp (ví dụ: chấm điểm bài thi chỉ có một chỗ implement duy nhất).

Các service sẽ được thêm dần theo từng phase, ví dụ:

- `examService.ts`, `attemptService.ts`, `questionService.ts` — Phase 6–7, 10–12
- `importService.ts`, `aiExtractionService.ts` — Phase 8–9
- `blueprintService.ts`, `questionMatchingService.ts`, `examGenerationService.ts` — module sinh đề
- `videoLessonService.ts`, `liveClassService.ts` — module Learning Content

Trống ở Phase 1 vì chưa implement tính năng nào.
