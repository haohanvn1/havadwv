// `pdfjs-dist` không xuất kiểu cho submodule worker (chỉ dùng nội bộ qua
// GlobalWorkerOptions.workerSrc dạng string) — khai báo ambient tối thiểu để
// import tĩnh nó được trong pdfParser.ts (xem comment ở đó để biết lý do).
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  const content: unknown;
  export = content;
}
