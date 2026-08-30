use serde_json::{json, Value};

pub(super) fn build_paddle_optional_payload(model: &str, _max_input_images: u16) -> Value {
    let normalized = model.trim().to_ascii_lowercase();
    if normalized.contains("pp-ocrv5") {
        return json!({
            "useDocOrientationClassify": false,
            "useDocUnwarping": false,
            "useTextlineOrientation": false
        });
    }

    json!({
        "useDocOrientationClassify": false,
        "useDocUnwarping": false,
        "useChartRecognition": false
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paddle_optional_payload_matches_async_api_contract() {
        let payload = build_paddle_optional_payload("PaddleOCR-VL-1.5", 888);
        assert_eq!(
            payload,
            json!({
                "useDocOrientationClassify": false,
                "useDocUnwarping": false,
                "useChartRecognition": false
            })
        );

        let ocr_payload = build_paddle_optional_payload("PP-OCRv5", 777);
        assert_eq!(ocr_payload["useTextlineOrientation"], false);
        assert!(ocr_payload.get("useChartRecognition").is_none());
    }
}
