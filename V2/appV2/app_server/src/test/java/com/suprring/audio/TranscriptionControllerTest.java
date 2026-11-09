package com.suprring.audio;

import com.suprring.chat.ChatFailure;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TranscriptionController.class)
class TranscriptionControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean TranscriptionClient client;
    @Test void returnsTranscript() throws Exception {
        when(client.transcribe(any(), eq("m4a"))).thenReturn("明天整理会议记录。");
        mvc.perform(multipart("/api/audio/transcriptions").file(new MockMultipartFile("file", "phone.m4a", "audio/mp4", new byte[]{1,2,3})))
                .andExpect(status().isOk()).andExpect(jsonPath("$.text").value("明天整理会议记录。"));
    }
    @Test void rejectsMissingEmptyAndUnsupportedFile() throws Exception {
        mvc.perform(multipart("/api/audio/transcriptions")).andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/audio/transcriptions").file(new MockMultipartFile("file", "empty.wav", "audio/wav", new byte[0]))).andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/audio/transcriptions").file(new MockMultipartFile("file", "a.html", "audio/wav", new byte[]{1}))).andExpect(status().isBadRequest());
        verifyNoInteractions(client);
    }
    @Test void rejectsLargeUpload() throws Exception {
        mvc.perform(multipart("/api/audio/transcriptions").file(new MockMultipartFile("file", "a.wav", "audio/wav", new byte[20 * 1024 * 1024 + 1]))).andExpect(status().isPayloadTooLarge());
        verifyNoInteractions(client);
    }
    @Test void returnsSafeProviderError() throws Exception {
        when(client.transcribe(any(), anyString())).thenThrow(new ChatFailure(422, "未识别到语音，请确认录音中有清晰的人声"));
        mvc.perform(multipart("/api/audio/transcriptions").file(new MockMultipartFile("file", "ring.ogg", "audio/ogg", new byte[]{1})))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.message").value("未识别到语音，请确认录音中有清晰的人声"));
    }
}
