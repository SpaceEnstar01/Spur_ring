package com.suprring.audio;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.suprring.chat.ChatFailure;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.Semaphore;

@Service
public class TranscriptionClient {
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final Semaphore slots = new Semaphore(2);
    private final ObjectMapper mapper;
    private final String key, baseUrl, model;
    public TranscriptionClient(ObjectMapper mapper, @Value("${siliconflow.api-key}") String key,
            @Value("${siliconflow.base-url}") String baseUrl,
            @Value("${siliconflow.transcription-model}") String model) {
        this.mapper = mapper; this.key = key; this.baseUrl = baseUrl; this.model = model;
    }
    public String transcribe(MultipartFile file, String extension) {
        if (key.isBlank()) throw new ChatFailure(503, "语音服务尚未配置 API Key");
        if (!slots.tryAcquire()) throw new ChatFailure(429, "转写请求较多，请稍后重试");
        try {
            String boundary = "Supr" + UUID.randomUUID();
            // Model and filename cannot inject multipart headers; filename never comes from the upload.
            if (model.contains("\r") || model.contains("\n")) throw new ChatFailure(503, "语音模型配置不正确");
            byte[] prefix = ("--" + boundary + "\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\n" + model
                    + "\r\n--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"recording." + extension
                    + "\"\r\nContent-Type: application/octet-stream\r\n\r\n").getBytes(StandardCharsets.UTF_8);
            byte[] suffix = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);
            var body = HttpRequest.BodyPublishers.concat(HttpRequest.BodyPublishers.ofByteArray(prefix),
                    HttpRequest.BodyPublishers.ofByteArray(file.getBytes()), HttpRequest.BodyPublishers.ofByteArray(suffix));
            var request = HttpRequest.newBuilder(URI.create(baseUrl.replaceAll("/+$", "") + "/audio/transcriptions"))
                    .timeout(Duration.ofSeconds(120)).header("Authorization", "Bearer " + key)
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary).POST(body).build();
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status == 401 || status == 403) throw new ChatFailure(502, "语音服务认证失败，请检查服务端配置");
            if (status == 429) throw new ChatFailure(503, "语音服务繁忙或额度不足，请稍后重试");
            if (status == 400 || status == 413 || status == 422) throw new ChatFailure(422, "语音服务无法识别该音频，请检查格式、时长或重新录制");
            if (status < 200 || status >= 300) throw new ChatFailure(502, "语音转写失败，请稍后重试");
            String result = mapper.readTree(response.body()).path("text").asText("").trim();
            if (result.isBlank()) throw new ChatFailure(422, "未识别到语音，请确认录音中有清晰的人声");
            return result;
        } catch (ChatFailure e) { throw e; }
        catch (HttpTimeoutException e) { throw new ChatFailure(504, "语音转写超时，请稍后重试"); }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new ChatFailure(503, "转写已中断"); }
        catch (Exception e) { throw new ChatFailure(502, "暂时无法连接语音服务"); }
        finally { slots.release(); }
    }
}
