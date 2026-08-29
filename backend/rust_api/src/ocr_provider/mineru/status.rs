use crate::ocr_provider::types::{OcrProviderKind, OcrTaskHandle, OcrTaskState, OcrTaskStatus};

fn map_state(raw_state: &str) -> OcrTaskState {
    match raw_state.trim() {
        "waiting-file" => OcrTaskState::WaitingUpload,
        "pending" => OcrTaskState::Queued,
        "running" => OcrTaskState::Running,
        "converting" => OcrTaskState::Converting,
        "done" => OcrTaskState::Succeeded,
        "failed" => OcrTaskState::Failed,
        _ => OcrTaskState::Unknown,
    }
}

fn stage_and_detail(raw_state: &str, state: &OcrTaskState) -> (&'static str, String) {
    match state {
        OcrTaskState::WaitingUpload => ("mineru_upload", "Đang chờ tải tệp lên MinerU".to_string()),
        OcrTaskState::Queued => (
            "mineru_processing",
            "MinerU đã nhận tác vụ, đang chờ xếp hàng".to_string(),
        ),
        OcrTaskState::Running => ("mineru_processing", "MinerU đang phân tích tệp".to_string()),
        OcrTaskState::Converting => ("mineru_processing", "MinerU đang chuyển đổi tệp".to_string()),
        OcrTaskState::Succeeded => (
            "ocr_result_ready",
            "Kết quả MinerU đã sẵn sàng, chuẩn bị chuẩn hóa".to_string(),
        ),
        OcrTaskState::Failed => ("failed", "Xử lý MinerU thất bại".to_string()),
        OcrTaskState::Unknown => (
            "mineru_processing",
            format!("Trạng thái MinerU: {}", raw_state.trim()),
        ),
    }
}

pub fn map_task_status(
    raw_state: &str,
    handle: OcrTaskHandle,
    provider_message: Option<String>,
    trace_id: Option<String>,
) -> OcrTaskStatus {
    let state = map_state(raw_state);
    let (stage, detail) = stage_and_detail(raw_state, &state);
    OcrTaskStatus {
        provider: OcrProviderKind::Mineru,
        handle,
        state,
        raw_state: Some(raw_state.trim().to_string()),
        stage: Some(stage.to_string()),
        detail: Some(detail),
        provider_message,
        trace_id,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_waiting_file_to_waiting_upload() {
        let status = map_task_status("waiting-file", OcrTaskHandle::default(), None, None);
        assert_eq!(status.state, OcrTaskState::WaitingUpload);
        assert_eq!(status.stage.as_deref(), Some("mineru_upload"));
    }

    #[test]
    fn maps_all_known_mineru_states() {
        let cases = [
            ("pending", OcrTaskState::Queued),
            ("running", OcrTaskState::Running),
            ("converting", OcrTaskState::Converting),
            ("done", OcrTaskState::Succeeded),
            ("failed", OcrTaskState::Failed),
        ];
        for (raw, expected) in cases {
            let status = map_task_status(raw, OcrTaskHandle::default(), None, None);
            assert_eq!(status.state, expected, "raw_state={raw}");
        }
    }
}
