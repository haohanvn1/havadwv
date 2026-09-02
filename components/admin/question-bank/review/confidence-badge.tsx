import { Badge } from "@/components/ui/badge";

/**
 * 🟢/🟡/🔴 theo đúng yêu cầu — confidence là tín hiệu ưu tiên review, không
 * phải sự thật tuyệt đối (mục 14), nên hiển thị rõ ràng nhưng không dùng
 * ngôn ngữ khẳng định ("đúng"/"sai").
 */
export function AIConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.8) {
    return (
      <Badge variant="default">
        🟢 Độ tin cậy AI cao ({Math.round(confidence * 100)}%)
      </Badge>
    );
  }
  if (confidence >= 0.5) {
    return (
      <Badge variant="secondary">
        🟡 Độ tin cậy AI trung bình ({Math.round(confidence * 100)}%)
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      🔴 Độ tin cậy AI thấp ({Math.round(confidence * 100)}%)
    </Badge>
  );
}

export function DetectionConfidenceBadge({ confidence }: { confidence: "high" | "low" }) {
  return confidence === "high" ? (
    <Badge variant="outline">Phát hiện rõ ràng</Badge>
  ) : (
    <Badge variant="secondary">Cần xem lại</Badge>
  );
}
