//! Backend spending authority. Provider availability is never approval to spend.
#[derive(Clone, Copy, Debug)]
pub enum PaidOperation {
    OpenAiResponses,
    AnthropicMessages,
    OpenAiRealtime,
    ElevenLabsSpeech,
}

/// No spending grants exist in this milestone. Keys, quota, preferences and
/// ambient environment variables cannot confer authority. A future grant must
/// be backend-owned, scoped to the exact operation and consumed before sending.
pub fn require_approval(operation: PaidOperation) -> Result<(), String> {
    let purpose = match operation {
        PaidOperation::OpenAiResponses => "OpenAI API reasoning",
        PaidOperation::AnthropicMessages => "Anthropic API reasoning",
        PaidOperation::OpenAiRealtime => "OpenAI realtime voice or transcription",
        PaidOperation::ElevenLabsSpeech => "ElevenLabs speech generation",
    };
    Err(format!("paid_call_approval_required: {purpose} is blocked. Explicit spending approval is required; no paid-call approval has been granted. No provider request was sent."))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_paid_operation_requires_approval_before_transport() {
        for operation in [PaidOperation::OpenAiResponses, PaidOperation::AnthropicMessages,
            PaidOperation::OpenAiRealtime, PaidOperation::ElevenLabsSpeech] {
            let mut transport_called = false;
            let result = require_approval(operation).and_then(|()| {
                transport_called = true;
                Ok(())
            });
            assert!(!transport_called, "{operation:?} reached transport without approval");
            assert!(result.unwrap_err().contains("approval_required"));
        }
    }
}
