# Mật Độ Thực Tế Được Xác Định Như Thế Nào?

Nếu bạn hình dung một ô văn bản như một cái hộp giấy, thì "mật độ" trả lời một câu hỏi:

**Với cỡ chữ và bước dòng hiện tại, nội dung dịch này có mỏng, vừa phải, hay quá tải khi nhồi vào hộp này không?**

Điều này tưởng chừng trực quan, nhưng triển khai trong mã thường không nhìn vào một chỉ số duy nhất. Bởi vì "đông hay không" ít nhất có hai nghĩa:

- Bản thân nội dung đã dài ra chưa
- Hộp bản thân có dung lượng chứa nội dung này không

Nên trong triển khai hiện tại, mật độ không phải một hằng số đơn lẻ mà được xác định chung bởi nhiều nhóm hàm.

---

## 1. Kết Luận Đầu: Chúng Ta Thực tế Nhìn Vào Hai Loại Mật Độ

Trong triển khai hiện tại, phần liên quan nhất đến "mật độ" không phải một hàm mà là hai dòng:

1. **Mật độ chiều dài**
   - Kiểm tra xem nội dung dịch đã "giãn nở" so với bản gốc chưa
   - Hàm tương ứng: `translation_density_ratio(...)`

2. **Mật độ bố cục**
   - Kiểm tra xem nội dung có quá拥挤 trong hộp ở cỡ chữ và bước dòng hiện tại không
   - Hàm tương ứng: `layout_density_ratio(...)`

Trong [fit.py](../../backend/scripts/services/rendering/layout/payload/fit.py), cả hai chỉ số cùng tham gia phán đoán:

```python
length_density_ratio = translation_density_ratio(item, protected_text)
layout_density = layout_density_ratio(box, protected_text, font_size_pt=font_size_pt, line_step_pt=line_step)
is_dense_block = length_density_ratio >= COMPACT_TRIGGER_RATIO or layout_density >= LAYOUT_COMPACT_TRIGGER_RATIO
```

Nói cách khác, hệ thống không hỏi đơn thuần "bản dịch có dài hơn" hay "hộp có gần đầy", mà hỏi cả hai.

---

## 2. Lớp 1: Nội Has Giãn Ra Đáng Kể Không

Cách trực tiếp nhất: bản gốc chỉ vài từ nhưng bản dịch trở thành đoạn rất dài; khả năng cao khó bố trí hơn.

Lớp này do `translation_density_ratio(...)` xử lý trong [text_common.py](../../backend/scripts/services/rendering/layout/payload/text_common.py):

```python
def translation_density_ratio(item: dict, protected_text: str) -> float:
    source_words = source_word_count(item)
    if source_words <= 0:
        return 0.0
    zh_chars = translated_zh_char_count(protected_text)
    if zh_chars <= 0:
        return 0.0
    return zh_chars / source_words
```

Hàm làm một thứ rất đơn giản:

- Đếm Approximate số từ tiếng Anh trong bản gốc: `source_word_count(item)`
- Đếm số ký tự tiếng Trung sau khi dịch: `translated_zh_char_count(protected_text)`
- Lấy tỷ lệ qua "ký tự tiếng Trung / số từ bản gốc"

Mục đích không phải "tính toán bố trí chính xác" mà là phán đoán nhanh:

**Bản dịch này có dễ拥挤 hơn thị giác so với bản gốc không?**

### Ví dụ

Giả sử block bản gốc:

- Số từ bản gốc: 20
- Ký tự tiếng Trung đã dịch: 18

Thì:

`ttranslation_density_ratio = 18 / 20 = 0.9`

Cho thấy đang ở ranh giới chặt.

Nếu block khác:

- Số từ bản gốc: 20
- Ký tự tiếng Trung đã dịch: 24

Thì:

`ttranslation_density_ratio = 24 / 20 = 1.2`

Block này thuộc loại "giãn nở đáng kể"; thường được xử lý bảo thủ hơn sau đó.

Ngưỡng hiện tại cũng nằm trong cùng tệp:

- `COMPACT_TRIGGER_RATIO = 0.9`
- `HEAVY_COMPACT_RATIO = 1.0`

Nói nôm na:

- `>= 0.9`: Đang bắt đầu chật
- `>= 1.0`: Đã là block rất dày đặc

---

## 3. Lớp 2: Hộp thực sự có đầy không ở Cỡ Chữ Hiện Tại

Lớp trước chỉ cho biết "nội dung có dài ra"; không nhìn hộp.

Cùng `ratio = 1.0` hai đoạn:

- Trong hộp body rộng 400pt có thể hoàn toàn ổn
- Trong hộp caption rộng 160pt có thể overflow ngay

Nên lớp hai phải nhìn "dung lượng hộp".

Bước này do `layout_density_ratio(...)` xử lý trong [text_common.py](../../backend/scripts/services/rendering/layout/payload/text_common.py):

```python
def layout_density_ratio(
    inner: list[float],
    protected_text: str,
    *,
    font_size_pt: float,
    line_step_pt: float,
) -> float:
    width = max(8.0, inner[2] - inner[0])
    height = max(8.0, inner[3] - inner[1])
    zh_chars = translated_zh_char_count(protected_text)
    approx_char_width = max(font_size_pt * 0.92, 1.0)
    chars_per_line = max(4.0, width / approx_char_width)
    required_lines = max(1.0, zh_chars / chars_per_line)
    occupied_height = required_lines * line_step_pt
    return occupied_height / height
```

Logic hàm theo ngôn ngữ nôm na:

1. Kiểm tra chiều rộng và chiều cao hộp
2. Assume chiều rộng ký hiệu xấp xỉ ở cỡ chữ hiện tại
3. Suy ra khoảng ký hiệu xấp xỉ mỗi dòng
4. Ước lượng bao nhiêu dòng bản dịch cần
5. Tính chiếm bao nhiêu chiều cao các dòng đó
6. Chia chiều cao chiếm dụng cho chiều cao hộp

Kết quả là tỷ lệ rất trực quan:

- `< 1.0`: Về lý thuyết vẫn chứa được
- `≈ 1.0:rất chật
- `> 1.0`: Về lý thuyết đã vượt hộp rồi

### Ví dụ

Giả sử hộp:

- Rộng: 180pt
- Cao: 90pt
- Font hiện tại: 9pt
- Khoảng giãn dòng: 12pt
- Ký tự dịch: 72

Ước lượng nôm na:

- Chiều rộng mỗi ký hiệu ≈ `9 × 0.92 = 8.28pt`
- Mỗi dòng ≈ `180 / 8.28 ≈ 21.7` ký tự
- 72 ký hiệu cần ≈ `72 / 21.7 ≈ 3.3` dòng
- Chiếm dụng ≈ `3.3 × 12 = 39.6pt`
- Mật độ bố cục ≈ `39.6 / 90 = 0.44`

Cho thấy block thực sự không đông.

Nếu nội dung tương tự trong hộp khác:

- Rộng: 110pt
- Cao: 48pt

Thì:

- Mỗi dòng ≈ `110 / 8.28 ≈ 13.3` ký tự
- 72 ký hiệu cần `72 / 13.3 ≈ 5.4` dòng
- Chiếm dụng ≈ `5.4 × 12 = 64.8pt`
- Mật độ bố cục ≈ `64.8 / 48 = 1.35`

Block điển hình mật độ cao; font hiện tại chắc chắn quá lớn.

---

## 4. Lớp 3: Dung Lượng "Thực Sự" của Hộp Được Tính Như Thế Nào

`layout_density_ratio(...)` ở trên là ước lượng nhanh, nhẹ, phù hợp cho phán đoán mật độ ban đầu.

Tính toán sát "hộp thực sự chứa được bao nhiêu nội dung" hơn nằm ở [capacity.py](../../backend/scripts/services/rendering/layout/payload/capacity.py).

Cốt lõi là `box_capacity_units(...)`:

```python
def box_capacity_units(
    inner: list[float],
    font_size_pt: float,
    leading_em: float,
    visual_lines: int | None = None,
) -> float:
    width = max(8.0, inner[2] - inner[0])
    height = max(8.0, inner[3] - inner[1])
    line_step = max(font_size_pt * 1.02, font_size_pt * (1.0 + leading_em))
    lines = max(1, int(height / line_step))
    if visual_lines and visual_lines > 1:
        lines = min(lines, max(1, visual_lines + 1))
    chars_per_line = max(4.0, width / max(font_size_pt * 0.92, 1.0))
    return lines * chars_per_line * 0.98
```

Là ba thứ:

1. Suy ra tổng số dòng có thể dựa trên cỡ chữ và spacing dòng
2. Suy ra nội dung mỗi dòng dựa trên rộng hộp
3. Nhân đôi để ra dung lượng hộp

Chi tiết quan trọng ở đây:

`visual_lines`

Nói cách khác, không hoàn toàn tin "chiều cao hộp cho bao nhiêu dòng"; tham chiếu số lượng dòng thị giác từ cấu trúc OCR / layout cho block bản gốc để tránh giả định dung lượng quá lạc quan.

---

## 5. Lớp 4:demand Nội Không Đơn Giản Là Đếm Ký Hiệu

Nếu tính dung lượng, làm sao tính "demand"?

Do `text_demand_units(...)` xử lý trong cùng tệp:

```python
def text_demand_units(protected_text: str, formula_map: list[dict]) -> float:
    formula_lookup = {entry["placeholder"]: entry["formula_text"] for entry in formula_map}
    return sum(token_units(token, formula_lookup) for token in tokenize_protected_text(protected_text))
```

Ý nghĩa:

- Tách văn bản thành tokens trước
- Văn bản bình thường tính là đơn vị bình thường
- Placeholder công thức không tính là 1 ký hiệu mà sát chi phí thị giác thực tế

Quan trọng vì chỉ nhìn đếm ký hiệu sẽ đánh giá thấp áp lực công thức.

### Ví dụ

Hai đoạn dưới đây có thể cùng số ký hiệu:

1. `Phương pháp này cải thiện đáng kể hiệu suất vật liệu.`
2. `Phương pháp này cải Thiện đáng kể hiệu suất vật liệu trong điều kiện [[FORMULA_1]].`

Nhưng đoạn hai có áp lực bố trí thực tế cao hơn nhờ công thức.

Hệ thống không coi chúng bằng nhau demand; gán cost thị giác cao hơn cho công thức qua `token_units(...)`.

---

## 6. Lớp 5: Vì Sao Giới thiệu Số Dòng Thị Giác

Vấn đề dễ bỏ qua:

**Đôi khi "số dòng OCR" không đáng tin.**

Ví dụ: đoạn Originally 4 dòng bị OCR dính thành 1 dòng. Nếu nhìn raw `lines` đơn thuần, đánh giá quá cao không gian bố trí còn lại trong hộp.

Nên [measurement.py](../../backend/scripts/services/rendering/layout/typography/measurement.py) có bộ hàm chuyên biệt sửa lỗi này:

- `plain_text_chars_per_line(...)`
- `_predicted_wrapped_line_count(...)`
- `visual_line_count(...)`
- `is_tall_single_line_glue(...)`

Trong đó `visual_line_count(...)` ý tưởng:

- Kiểm tra số dòng OCR báo trước
- Ước lượng "nếu wrap bình thường nên là mấy dòng" dựa trên độ dài văn bản, rộng hộp, công lực ký hiệu mỗi dòng
- Nếu predicted lines cao hơn OCR lines đáng kể, dùng con số bảo thủ hơn

Mục đích không tính cỡ chữ mà ngăn phán đoán mật độ bị nhiễu dữ kiện giả.

### Điển Hình

Giả sử block:

- OCR chỉ报 1 dòng
- Nhưng hộp cao; độ dài văn bản 140 ký
- Về mặt hình học không thể fits nổi tất cả vào 1 dòng

Thì `visual_line_count(...)` kết luận:

"Chắc không phải một-dòng body mà paragraph đa-dòng bị OCR dính thành 1."

Hệ thống dùng giá trị dự đoán để chỉnh sửa phán đoán dung lượng sau đó. Mật độ tính theo cách này sát thực tế hơn.

---

## 7. Mật Độ cuối Cùng Ảnh Hưởngถึง Cỡ Chữ Như Thế Nào

Các hàm này không trực tiếp xuất ra "cỡ chữ cuối cùng"; vai trò hơn giống cung cấp cơ sở phán đoán cho engine bố trí.

Điểm đáp trực tiếp nhất trong `fit_translated_block_metrics(...)` của [fit.py](frontend/screens/backend/scripts/services/rendering/layout/payload/fit.py):

```python
capacity = box_capacity_units(box, font_size_pt, leading_em, visual_lines=visual_lines)
if capacity <= 0 or (demand <= capacity * 0.96 and layout_density < LAYOUT_DENSITY_SAFE_MAX):
    return font_size_pt, leading_em
```

Logic ở đây then chốt:

- Nếu demand không sát dung lượng
- Và mật độ bố cục không quá cao

Thì giữ lại cỡ chữ hiện tại.

Ngược lại nếu:

- `demand > capacity`
- Hoặc `layout_densi` đã quá cao

Thì đi vào luồng thu nhỏ cỡ chữ, nén spacing dòng.

Nói cách khác, mật độ không trực tiếp xuất ra con số như "9.2pt" hay "8.8pt" mà quyết định:

- Có thu không
- Thu mấy bước
- Chỉ thu font hay đồng thời compress dòng

---

## 8. Có Thể Hiểu Như Chuỗi Phán Đoan Rất Đơn Giản

Nén tất cả hàm vào ngôn ngữ nôm na yields chuỗi xấp xỉ như thế này:

1. **Kiểm tra bản dịch có giãn ra đáng kể không**
   - `translation_density_ratio(...)`

2. **Xem nội dung chiếm bao nhiêu chiều cao trong hộp ở font hiện tại**
   - `layout_density_ratio(...)`

3. **Ước nghiêm ngặt hơn hộp thực sự chứa được bao nhiêu unit**
   - `box_capacity_units(...)`

4. **Không hoàn toàn tin số dòng OCR; dùng `visual_line_count(...)` để chỉnh**

5. **Quyết định thu font bằng "demand so với capacity"**
   - `text_demand_units(...)` so với `box_capacity_units(...)`

---

## 9. Hoàn Chỉnh Toàn Ví Dụ

Giả sử block dịch có những điều kiện này:

- Rộng hộp: 145pt
- Cao hộp: 62pt
- Font khởi đầu: 9.4pt
- Interlinear: 0.58em
- Số từ bản gốc: 18
- Ký tự dịch: 22
- Chứa 2 công thức

Hệ thống xem như:

### Bước 1: Nội Has Giãn Không

`translation_density_ratio = 22 / 18 ≈ 1.22`

Đã là block rất chặt.

### Bước 2: Bố Cục Có Quá đông ở Font Hiện Không

Ước lượng bở `layout_density_ratio(...)`:

- Hộp khá hẹp
- Ít ký mỗi dòng ở 9.4pt
- Áp lực ngắt dòng thực lớn hơn nữa nhờ công thức

Layout density tính ra có thể tiếp cận hoặc vượt `1.0`

### Bước 3: Kiểm tra Công Suẩ và Nhu Cầu

- `box_capacity_units(...)` find total box capacity nhỏ
- `text_demand_units(...)` tăng demand nhờ công thức

Kết thúc hình thành:

**Block mật độ cao; font hiện tại không an toàn.**

### Bước 4: Đi vào Thu Nhỏ

`fit_translated_block_metrics(...)` bắt đầu thử:

- Giảm font chút mỗi bước
- Nếu không đủ, compress leading chút
- Tiếp tục thử cho đến quando demand không còn vượt xa capacity

Đây là quy trình hoàn chỉnh của "cách phán đoán mật độ ảnh hưởng đến cỡ chữ thực tế".

---

## 10. Tóm Tắt Cuối Cùng

Cái gọi là "mật độ hộp" về的本质 không phải hỏi:

"Bao nhiêu ký tự trong hộp này?"

Mà hỏi:

**Ở font và spacing dòng hiện tại, gap giữa dung lượng hữu dụng của hộp và demand thực của nội dịch này còn dư bao nhiêu?**

Trong triển hiện tại, được trả lời chung bởi các nhóm hàm sau:

- Hiệu chỉnh thông tin trang và dòng gốc:
  - [measurement.py](../../backend/scripts/services/rendering/layout/typography/measurement.py)
- Mô phỏng độ dài văn bản và mật độ bố cục:
  - [text_common.py](../../backend/scripts/services/rendering/layout/payload/text_common.py)
- Tính toán capacity và demand:
  - [capacity.py](../../backend/scripts/services/rendering/layout/payload/capacity.py)
- Quyết định thu font cuối cùng:
  - [fit.py](../../backend/scripts/services/rendering/layout/payload/fit.py)

Nếu trace thêm "vì sao font cuối cùng lại nhỏ đi", answer thường quay về:

**Bởi vì demand nội dung block hiện tại đã tiếp cận hoặc vượt capacity hộp ở font hiện tại.**
