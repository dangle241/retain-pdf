// Lớp logic thuần của trình sửa chú thích: không chạm DOM/React, thuận tiện cho unit test node.
// Chú thích là bản ghi mục đã lưu từ máy chủ sau chuẩn hóa; xem hình dạng tại tests/reader-annotations-vm.test.mjs.

// Ánh xạ kind sang nội dung hiển thị: đóng băng để lớp hiển thị không vô tình sửa.
export const ANNOTATION_KIND_META = Object.freeze({
  sentence: { label: "Câu" },
  data: { label: "Dữ liệu" },
  figure: { label: "Biểu đồ" },
});

// Sắp theo số trang rồi thời gian tạo; xuất và hiển thị danh sách đều phụ thuộc thứ tự ổn định này.
export function sortAnnotations(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return [...list].sort((a, b) => {
    const pageDelta = Number(a?.pageIdx ?? 0) - Number(b?.pageIdx ?? 0);
    if (pageDelta !== 0) {
      return pageDelta;
    }
    // createdAt là chuỗi ISO nên thứ tự từ điển cũng là thứ tự thời gian.
    const left = `${a?.createdAt || ""}`;
    const right = `${b?.createdAt || ""}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

// Nhóm theo trang: lớp hiển thị thu gọn theo trang và phần xuất tạo mục theo trang cùng dùng kết quả nhóm này.
export function groupAnnotationsByPage(list) {
  const groups = [];
  for (const annotation of sortAnnotations(list)) {
    const pageIdx = Number(annotation?.pageIdx ?? 0);
    const last = groups[groups.length - 1];
    if (last && last.pageIdx === pageIdx) {
      last.items.push(annotation);
    } else {
      groups.push({ pageIdx, items: [annotation] });
    }
  }
  return groups;
}

// Đổi văn bản nhiều dòng thành khối trích dẫn Markdown: mỗi dòng cần tiền tố "> ", nếu không xuống dòng sẽ thoát trích dẫn.
function toQuoteBlockLines(text) {
  return `${text || ""}`.split("\n").map((line) => `> ${line}`);
}

// Tạo Markdown để xuất bằng ghép chuỗi thuần, thuận tiện unit test chính xác và dùng lại cho sao chép/tải xuống.
export function buildAnnotationsMarkdown({ title = "", annotations = [] } = {}) {
  const heading = title ? `# Chú thích cho ${title}` : "# Chú thích";
  const groups = groupAnnotationsByPage(annotations);
  if (groups.length === 0) {
    return `${heading}\n\n(Chưa có chú thích)\n`;
  }
  const lines = [heading, ""];
  for (const group of groups) {
    // pageIdx gốc 0; khi hiển thị cho người dùng phải đổi sang số trang gốc 1.
    lines.push(`## Trang ${group.pageIdx + 1}`, "");
    for (const annotation of group.items) {
      lines.push(...toQuoteBlockLines(annotation?.quoteText));
      if (annotation?.translatedQuoteText) {
        // Bản dịch nằm sát khối trích dẫn nguyên văn; dùng — để đánh dấu đây là bản dịch, không phải dòng tiếp của nguyên văn.
        lines.push(...toQuoteBlockLines(`—— ${annotation.translatedQuoteText}`));
      }
      if (annotation?.note) {
        lines.push("", `Ghi chú: ${annotation.note}`);
      }
      // Để một dòng trống sau mỗi chú thích; chuỗi "" cuối cũng bảo đảm toàn bài kết thúc bằng xuống dòng.
      lines.push("");
    }
  }
  return lines.join("\n");
}

// Trích xuất điểm neo chuyển tới: trình đọc chỉ cần số trang + id khối để định vị lại nguyên văn.
export function annotationAnchor(annotation) {
  return {
    pageIdx: annotation?.pageIdx,
    blockId: annotation?.blockId,
  };
}
