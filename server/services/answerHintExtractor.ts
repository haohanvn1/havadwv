import "server-only";

export interface AnswerHint {
  /** Mô tả ngắn để đưa vào prompt AI làm bằng chứng — null nếu không phát hiện được gì. */
  text: string | null;
  /** Nhãn option được đánh dấu đúng bằng "*" ngay trước, vd "A", "B" — rỗng nếu không có/không phải dạng trắc nghiệm. */
  markedOptionLabels: string[];
  /** Text sau "Đáp án:"/"Đ/án:" — dùng cho SHORT_ANSWER. */
  answerKeyValue: string | null;
}

/**
 * Dò các dấu hiệu đáp án CHẮC CHẮN bằng quy tắc cố định (không phải AI) từ
 * chính raw text của draft — theo đúng 2 trường hợp phổ biến trong đề thi
 * thật (xem file tham chiếu Phase 7B): (1) đáp án đánh dấu bằng "*" ngay
 * trước option, (2) đáp án ghi rõ dạng "Đáp án: X" / "Đ/án: X" ở cuối câu.
 * Kết quả này được truyền cho AI như bằng chứng ưu tiên, không để AI tự đoán
 * lại đáp án khi đã có tín hiệu rõ ràng hơn.
 */
export function extractAnswerHint(rawText: string): AnswerHint {
  // "*A." / "*A)" / "* A." — dấu * ngay trước một nhãn chữ cái option.
  const markedOptionLabels = [...rawText.matchAll(/\*\s*([A-Da-d])[.)]/g)].map((m) =>
    m[1].toUpperCase(),
  );

  // "Đáp án: 6,67" / "Đ/án: 24" / "Đáp án:24" — SHORT_ANSWER. Bắt buộc có dấu
  // ":" hoặc "." ngay sau "án" (không để tuỳ chọn) — nếu không, các câu văn
  // tự nhiên có chứa cụm "đáp án" (vd "không có đáp án nào được đánh dấu")
  // sẽ bị nhận nhầm thành một dòng công bố đáp án.
  const answerKeyMatch = rawText.match(/Đ(?:áp\s*án|\/án)\s*[:.]\s*([^\n]{1,80})/i);
  const answerKeyValue = answerKeyMatch ? answerKeyMatch[1].trim().replace(/\.$/, "") : null;

  const lines: string[] = [];
  if (markedOptionLabels.length > 0) {
    const unique = [...new Set(markedOptionLabels)];
    lines.push(
      unique.length === 1
        ? `Văn bản gốc đánh dấu "*" ngay trước đáp án ${unique[0]} — đây là đáp án đúng.`
        : `Văn bản gốc đánh dấu "*" trước nhiều đáp án: ${unique.join(", ")} (có thể là câu nhiều đáp án đúng, hoặc câu đúng/sai nhiều ý — mỗi ý một đáp án đúng riêng).`,
    );
  }
  if (answerKeyValue) {
    lines.push(`Văn bản gốc ghi rõ đáp án: "${answerKeyValue}".`);
  }

  return {
    text: lines.length > 0 ? lines.join(" ") : null,
    markedOptionLabels: [...new Set(markedOptionLabels)],
    answerKeyValue,
  };
}
