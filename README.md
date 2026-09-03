# HavaEdu — Nền tảng ôn luyện ĐGNL / ĐGTD

Ứng dụng full-stack phục vụ học sinh ôn luyện các kỳ thi Đánh giá tư duy (ĐGTD),
Đánh giá năng lực (ĐGNL) và các kỳ thi tương tự.

> **Trạng thái hiện tại: Phase 3 — Authentication & Authorization.** Đã có đăng
> nhập, phân quyền ADMIN/STUDENT, và dashboard/profile placeholder cho cả hai
> vai trò. Chưa có Question Bank, Exam, AI, import PDF/DOCX, YouTube, Zoom.

## Tech stack

| Lớp         | Công nghệ                                           |
| ----------- | --------------------------------------------------- |
| Framework   | Next.js (App Router) + TypeScript                   |
| UI          | Tailwind CSS + shadcn/ui                            |
| Database    | PostgreSQL + Prisma                                 |
| Auth        | Session JWT tự viết bằng `jose` (xem chi tiết dưới) |
| Validation  | Zod                                                 |
| Test        | Vitest (unit + HTTP integration)                    |
| Lint/Format | ESLint + Prettier (+ prettier-plugin-tailwindcss)   |

## Yêu cầu môi trường

- Node.js 20+
- PostgreSQL 14+ đang chạy (local hoặc cloud)

## Cài đặt

```bash
npm install
cp .env.example .env   # rồi sửa DATABASE_URL + đặt SESSION_SECRET mới cho máy bạn
npx prisma generate
npx prisma migrate dev   # tạo schema trong database
npx prisma db seed       # tạo dữ liệu tối thiểu để test (xem bên dưới)
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) — sẽ tự chuyển tới `/login`.

## Development credentials

**⚠️ CHỈ DÙNG CHO MÔI TRƯỜNG DEVELOPMENT — không phải mật khẩu thật, tuyệt đối
không dùng lại cho production.** Được tạo bởi `prisma/seed.ts`.

| Tài khoản | Username   | Password      | Vai trò |
| --------- | ---------- | ------------- | ------- |
| Admin     | `admin`    | `Admin@123`   | ADMIN   |
| Student 1 | `student1` | `Student@123` | STUDENT |
| Student 2 | `student2` | `Student@123` | STUDENT |

## Scripts

| Lệnh                 | Mô tả                                                |
| -------------------- | ---------------------------------------------------- |
| `npm run dev`        | Chạy dev server                                      |
| `npm run build`      | Build production                                     |
| `npm run start`      | Chạy server đã build                                 |
| `npm run lint`       | ESLint                                               |
| `npm run typecheck`  | Kiểm tra kiểu TypeScript (không emit)                |
| `npm run format`     | Format toàn bộ code bằng Prettier                    |
| `npm run test`       | Chạy toàn bộ test (unit + HTTP, tự spawn dev server) |
| `npx prisma studio`  | Xem/sửa dữ liệu bằng UI                              |
| `npx prisma db seed` | Chạy lại seed (upsert — an toàn chạy nhiều lần)      |

## Cấu trúc thư mục

```
app/
├─ login/                 Trang đăng nhập (Server Component + Client form)
├─ admin/                 Route chỉ ADMIN — layout gọi requireRole("ADMIN")
├─ student/                Route chỉ STUDENT — layout gọi requireRole("STUDENT")
└─ api/admin/, api/student/  Route Handler được bảo vệ bằng requireRoleApi()

lib/auth/
├─ session.ts             Ký/xác thực JWT bằng jose (chạy được cả Edge lẫn Node)
├─ cookies.ts              Đọc/ghi cookie session (Node runtime, next/headers)
├─ password.ts             Hash/so khớp mật khẩu (bcryptjs)
├─ rate-limit.ts           Giới hạn số lần thử đăng nhập (in-memory)
├─ guards.ts               requireAuth/requireRole (trang) + requireAuthApi/requireRoleApi (API)
└─ actions.ts               Server Actions loginAction/logoutAction

proxy.ts                  Route protection ở Edge (tên file mới thay cho middleware.ts ở Next 16)
server/services/          Business logic dùng chung giữa Server Action và API Route
validators/                Zod schema dùng chung client/server
tests/                      Vitest — unit (session, authService) + HTTP integration (authorization)
prisma/schema.prisma       Toàn bộ database schema (29 bảng, xem tài liệu thiết kế Phase 2)
```

## Authentication architecture

**Không dùng NextAuth/Auth.js** — tự viết session bằng `jose` (thư viện ký JWT
nhỏ, chạy được cả Edge runtime lẫn Node, cũng là thư viện NextAuth dùng bên
trong). Lý do: Next.js 16 + Prisma 7 còn rất mới, một framework auth lớn có
rủi ro tương thích; yêu cầu ở đây (username/password + RBAC 2 role) không cần
tới độ phức tạp của OAuth/multi-provider.

**Hai lớp kiểm tra** (áp dụng nhất quán cho mọi route/action/API):

1. **`proxy.ts` (Edge, nhanh)** — chỉ verify chữ ký + hạn JWT + đọc `role` từ
   token để redirect theo `/admin/*` hay `/student/*`. Không gọi database.
2. **`requireAuth()`/`requireRole()` (Node runtime)** — verify lại JWT **và**
   đọc `status` mới nhất từ DB trước khi cho qua. Đây là lớp thật sự chặn tài
   khoản vừa bị khoá, vì JWT là stateless và middleware không tự biết được.

Session lưu trong cookie `session`: `httpOnly`, `sameSite=lax`, `secure` khi
`NODE_ENV=production`, hết hạn sau 7 ngày. Không có gì liên quan tới auth được
lưu ở `localStorage`.

## Authorization (RBAC)

| Route            | Ai vào được | Chưa đăng nhập | Sai vai trò                    |
| ---------------- | ----------- | -------------- | ------------------------------ |
| `/admin/*`       | ADMIN       | → `/login`     | STUDENT → `/student/dashboard` |
| `/student/*`     | STUDENT     | → `/login`     | ADMIN → `/admin/dashboard`     |
| `/api/admin/*`   | ADMIN       | 401 JSON       | 403 JSON                       |
| `/api/student/*` | STUDENT     | 401 JSON       | 403 JSON                       |

Sai vai trò không hiện trang lỗi chết — tự động đưa về dashboard đúng vai trò
của chính người đó, vì nội dung của khu vực kia chưa từng được render ra
(chặn ở layout trước khi children mount).

## Document Import Pipeline (Phase 7A)

Admin có thể tải lên đề thi dạng PDF/DOCX ở `/admin/question-bank/import` để
tự động tách thành các câu hỏi nháp, thay vì gõ tay từng câu. Luồng xử lý:

```
Upload (PDF/DOCX)
  → ImportedFile      (lưu metadata + file gốc qua FileStorageService)
  → ImportJob         (PENDING → PROCESSING → DONE | FAILED)
  → DocumentParser     (pdfjs-dist cho PDF theo từng trang, mammoth cho DOCX)
  → ParsedDocument     (representation chuẩn hoá, không phụ thuộc định dạng gốc)
  → QuestionCandidateDetector (dò pattern "Câu N.", "Question N", "N." — KHÔNG AI)
  → ImportQuestionDraft (mỗi candidate một draft, giữ page/nguồn để trace lại)
```

**Quan trọng: Phase 7A chưa dùng AI ở bất kỳ bước nào** — việc tách câu hỏi
hoàn toàn dựa trên pattern-matching. Nếu không pattern nào khớp đủ tin cậy,
toàn bộ text được giữ nguyên thành 1 draft duy nhất kèm cảnh báo "cần xem
lại", không bao giờ làm mất dữ liệu. Draft **không** tự động trở thành
Question — đó là một bước duyệt thủ công riêng (Admin Review → Approve) dự
kiến ở Phase 7B.

`FileStorageService` (`server/services/fileStorageService.ts`) là một
interface trừu tượng (`save/read/delete/getMetadata`); implementation hiện
tại lưu ở local filesystem (`storage/imports/{uuid}/original.{ext}`, xem
`IMPORT_STORAGE_DIR` trong `.env.example`) — chuyển sang S3/R2/Supabase
Storage sau này chỉ cần viết implementation mới, không sửa business logic.

## Security

- **Password**: hash bằng bcrypt (`bcryptjs`, 10 rounds) — không bao giờ lưu plaintext.
- **Chống dò username**: `authenticate()` luôn chạy `bcrypt.compare` (kể cả khi
  user không tồn tại, so với một hash giả) và luôn trả về đúng một thông báo
  lỗi chung `"Tài khoản hoặc mật khẩu không chính xác."` cho mọi lý do thất
  bại (sai mật khẩu / không tồn tại / bị khoá) — có test khẳng định 3 message
  giống hệt nhau ở `tests/unit/authService.test.ts`.
- **Rate limiting**: tối đa 5 lần thử/15 phút theo username — in-memory, đủ
  cho 1 instance; cần chuyển sang store dùng chung (Redis) nếu scale nhiều
  instance sau này.
- **Open redirect**: tham số `?from=` sau khi bị chặn chỉ được dùng để redirect
  lại nếu là đường dẫn nội bộ hợp lệ (`isSafeRedirectPath`), chặn `//evil.com`.
- **CSRF**: dùng Server Actions của Next.js (có kiểm tra Origin tích hợp sẵn)
  thay vì form POST tới API endpoint thường — không cần token CSRF thủ công.
- **XSS**: React escape mặc định, không có `dangerouslySetInnerHTML` nào trong auth flow.
- **SQL injection**: mọi query qua Prisma (tham số hoá), không có raw SQL nối chuỗi.
- **Cookie**: `httpOnly` + `sameSite=lax` + `secure` (production) — không có
  token nhạy cảm nào ở `localStorage`.
- **Validation**: Zod ở server cho input login (`validators/auth.ts`) — không
  chỉ tin validate phía client.

## Test

```bash
npm run test
```

24 test, 3 file:

- `tests/unit/session.test.ts` — ký/verify JWT, từ chối token rác/hết hạn/sai chữ ký/sai role.
- `tests/unit/authService.test.ts` — login đúng, sai mật khẩu, user không tồn
  tại, user INACTIVE, và thông báo lỗi giống hệt nhau cho cả 3 trường hợp
  thất bại (chạy trên database dev thật, tự dọn dữ liệu test sau khi xong).
- `tests/http/authorization.test.ts` — tự khởi động một server `next dev`
  riêng (cổng 3100) và gọi thẳng HTTP thật: unauthenticated/ADMIN/STUDENT ×
  trang admin/student × API admin/student, đúng theo bảng RBAC ở trên.

## Ghi chú

- Không commit `.env` (đã có trong `.gitignore`).
- `lib/generated/prisma` là code tự sinh bởi `prisma generate`, cũng đã bị ignore.
- Đổi `SESSION_SECRET` sẽ làm mọi session đang đăng nhập bị đăng xuất ngay lập tức.
