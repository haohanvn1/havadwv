// Thay thế cho package "server-only" khi chạy dưới Vitest (xem vitest.config.ts).
// "server-only" chỉ hoạt động đúng bên trong bundler của Next.js — chạy nó
// ngoài Next (kể cả trong test) sẽ luôn throw, nên cần alias sang file rỗng
// này để import các module lib/auth/*, server/services/* không bị lỗi.
export {};
