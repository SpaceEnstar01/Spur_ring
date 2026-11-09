package com.suprring.chat;

import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<?> tooLarge(Exception error) {
        return ResponseEntity.status(413).body(Map.of("message", "录音不能超过 20 MB，请分段录制"));
    }
    @ExceptionHandler(org.springframework.web.multipart.support.MissingServletRequestPartException.class)
    public ResponseEntity<?> missingFile(Exception error) {
        return ResponseEntity.badRequest().body(Map.of("message", "请选择录音文件"));
    }
    @ExceptionHandler(ChatFailure.class)
    public ResponseEntity<?> upstream(ChatFailure error) {
        return ResponseEntity.status(error.status).body(Map.of("message", error.getMessage()));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<?> invalid(Exception error) {
        return ResponseEntity.badRequest().body(Map.of("message", "消息格式不正确或内容过长"));
    }
}
