export class DraftNotFoundError extends Error {
  constructor() {
    super("Không tìm thấy câu hỏi nháp.");
    this.name = "DraftNotFoundError";
  }
}

export class DraftAlreadyApprovedError extends Error {
  constructor() {
    super("Câu hỏi này đã được phê duyệt — không thể thực hiện thao tác này.");
    this.name = "DraftAlreadyApprovedError";
  }
}

export class DraftAlreadyRejectedError extends Error {
  constructor() {
    super("Câu hỏi này đã bị từ chối.");
    this.name = "DraftAlreadyRejectedError";
  }
}

export class DraftValidationError extends Error {
  fieldErrors?: Record<string, string>;
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "DraftValidationError";
    this.fieldErrors = fieldErrors;
  }
}
