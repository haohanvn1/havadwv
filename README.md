# HavaEdu — Nền tảng ôn luyện ĐGNL / ĐGTD

Ứng dụng full-stack phục vụ học sinh ôn luyện các kỳ thi Đánh giá tư duy (ĐGTD),
Đánh giá năng lực (ĐGNL) và các kỳ thi tương tự.

> **Trạng thái hiện tại: Phase 1 — Project setup.** Chưa có authentication, chưa
> có tính năng Admin/Student/Exam. Repo hiện chỉ là bộ khung dự án.

## Tech stack

| Lớp         | Công nghệ                                         |
| ----------- | ------------------------------------------------- |
| Framework   | Next.js (App Router) + TypeScript                 |
| UI          | Tailwind CSS + shadcn/ui                          |
| Database    | PostgreSQL + Prisma                               |
| Validation  | Zod                                               |
| Lint/Format | ESLint + Prettier (+ prettier-plugin-tailwindcss) |

## Yêu cầu môi trường

- Node.js 20+
- PostgreSQL 14+ đang chạy (local hoặc cloud)

## Cài đặt

```bash
npm install
cp .env.example .env   # rồi sửa DATABASE_URL cho khớp Postgres của bạn
npx prisma generate
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Scripts

| Lệnh                | Mô tả                                 |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Chạy dev server                       |
| `npm run build`     | Build production                      |
| `npm run start`     | Chạy server đã build                  |
| `npm run lint`      | ESLint                                |
| `npm run typecheck` | Kiểm tra kiểu TypeScript (không emit) |
| `npm run format`    | Format toàn bộ code bằng Prettier     |

## Cấu trúc thư mục

```
app/                  Route (App Router) — trang & API route
components/ui/        Component shadcn/ui (tự sinh khi `npx shadcn add ...`)
lib/prisma.ts         Prisma Client singleton
lib/generated/prisma/  Prisma Client tự sinh — không sửa tay, không commit logic vào đây
server/services/      Business logic — Server Actions và API Routes đều gọi vào đây
validators/           Zod schema dùng chung client/server
types/                Type/enum dùng chung không tiện đặt cạnh một service cụ thể
prisma/schema.prisma   Định nghĩa database (models sẽ thêm ở Phase 2)
```

## Database

Schema hiện đang trống (chỉ có `datasource`/`generator`) — models sẽ được thêm ở
**Phase 2 — Database + Prisma** theo đúng thiết kế đã được xác nhận riêng. Xem
`prisma/schema.prisma` và `prisma7.config.ts`.

## Ghi chú

- Không commit `.env` (đã có trong `.gitignore`).
- `lib/generated/prisma` là code tự sinh bởi `prisma generate`, cũng đã bị ignore.
