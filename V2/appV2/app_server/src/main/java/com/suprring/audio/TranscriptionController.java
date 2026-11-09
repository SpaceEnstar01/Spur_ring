package com.suprring.audio;

import com.suprring.chat.ChatFailure;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Locale;
import java.util.Map;

@RestController
public class TranscriptionController {
    private final TranscriptionClient client;
    public TranscriptionController(TranscriptionClient client) { this.client = client; }

    @PostMapping(value = "/api/audio/transcriptions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> transcribe(@RequestPart("file") MultipartFile file) {
        if (file.isEmpty()) throw new ChatFailure(400, "请选择有效的录音文件");
        if (file.getSize() > 20 * 1024 * 1024) throw new ChatFailure(413, "录音不能超过 20 MB，请分段录制");
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        String ext = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1) : "";
        if (!Map.of("m4a", "audio/mp4", "ogg", "audio/ogg", "wav", "audio/wav", "mp3", "audio/mpeg").containsKey(ext)) {
            throw new ChatFailure(400, "支持 M4A、OGG、WAV 和 MP3 录音");
        }
        return Map.of("text", client.transcribe(file, ext));
    }
}
