package com.suprring.guard;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
@EnableConfigurationProperties(ApiGuardProperties.class)
public class ApiGuardFilter extends OncePerRequestFilter {
    private final ApiGuardProperties limits;
    private final RequestBudget budget;
    private final ObjectMapper mapper;

    public ApiGuardFilter(ApiGuardProperties limits, ObjectMapper mapper) {
        this.limits = limits;
        this.budget = new RequestBudget(limits, System::currentTimeMillis);
        this.mapper = mapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Protect all POST routes, including encoded/trailing-slash variants and future APIs.
        return !"POST".equals(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        // Never trust caller-supplied X-Forwarded-For, Forwarded or device IDs for quotas.
        var decision = budget.acquire(request.getRemoteAddr());
        if (!decision.allowed()) {
            response.setHeader("Retry-After", Long.toString(decision.retryAfter()));
            reject(response, 429, decision.message());
            return;
        }
        boolean async = false;
        try {
            HttpServletRequest checked = request;
            String contentType = request.getContentType();
            if (contentType == null || !contentType.toLowerCase(java.util.Locale.ROOT)
                    .startsWith("multipart/form-data")) {
                if (request.getContentLengthLong() > limits.maxJsonBytes()) {
                    reject(response, 413, "消息内容过大，请减少对话或笔记长度");
                    return;
                }
                byte[] body = request.getInputStream().readNBytes(limits.maxJsonBytes() + 1);
                if (body.length > limits.maxJsonBytes()) {
                    reject(response, 413, "消息内容过大，请减少对话或笔记长度");
                    return;
                }
                checked = new BufferedRequest(request, body);
            }
            chain.doFilter(checked, response);
        } finally {
            if (request.isAsyncStarted()) {
                try {
                    request.getAsyncContext().addListener(new AsyncListener() {
                        public void onComplete(AsyncEvent event) { decision.release().run(); }
                        public void onTimeout(AsyncEvent event) { /* Hold until completion. */ }
                        public void onError(AsyncEvent event) { /* Hold until completion. */ }
                        public void onStartAsync(AsyncEvent event) {
                            event.getAsyncContext().addListener(this);
                        }
                    });
                    async = true;
                } catch (IllegalStateException alreadyCompleted) {
                    // Completion raced with listener registration; release below.
                }
            }
            if (!async) decision.release().run();
        }
    }

    private void reject(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader("Cache-Control", "no-store");
        mapper.writeValue(response.getOutputStream(), Map.of("message", message));
    }

    private static final class BufferedRequest extends HttpServletRequestWrapper {
        private final byte[] body;
        BufferedRequest(HttpServletRequest request, byte[] body) { super(request); this.body = body; }
        @Override public ServletInputStream getInputStream() {
            var input = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                public int read() { return input.read(); }
                public int read(byte[] b, int off, int len) { return input.read(b, off, len); }
                public boolean isFinished() { return input.available() == 0; }
                public boolean isReady() { return true; }
                public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException("Synchronous JSON request body only");
                }
            };
        }
        @Override public BufferedReader getReader() {
            String encoding = getCharacterEncoding();
            return new BufferedReader(new InputStreamReader(getInputStream(),
                    encoding == null ? StandardCharsets.UTF_8 : java.nio.charset.Charset.forName(encoding)));
        }
    }
}
