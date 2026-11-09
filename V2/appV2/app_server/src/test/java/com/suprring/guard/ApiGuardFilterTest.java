package com.suprring.guard;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class ApiGuardFilterTest {
    private ApiGuardFilter filter(int perClient, int concurrent, int maxBytes) {
        return new ApiGuardFilter(new ApiGuardProperties(60, 500, perClient, concurrent, 2048, maxBytes),
                new ObjectMapper());
    }
    private MockHttpServletRequest request(String path) {
        var request = new MockHttpServletRequest("POST", path);
        request.setRemoteAddr("10.0.0.1");
        request.setContentType("application/json");
        request.setContent("{\"messages\":[]}".getBytes(StandardCharsets.UTF_8));
        return request;
    }

    @Test void spoofedHeadersCannotBypassSharedEndpointQuota() throws Exception {
        var filter = filter(1, 4, 1024);
        var hits = new AtomicInteger();
        filter.doFilter(request("/api/chat"), new MockHttpServletResponse(), (r, s) -> hits.incrementAndGet());
        for (String path : new String[]{"/api/chat/stream", "/api/audio/transcriptions", "/api/%63hat", "/api/chat;v=1"}) {
            var request = request(path);
            request.addHeader("X-Forwarded-For", "1.2.3.4");
            request.addHeader("Forwarded", "for=9.8.7.6");
            request.addHeader("X-Device-ID", path);
            var response = new MockHttpServletResponse();
            filter.doFilter(request, response, (r, s) -> hits.incrementAndGet());
            assertEquals(429, response.getStatus());
            assertNotNull(response.getHeader("Retry-After"));
            assertNotNull(new ObjectMapper().readTree(response.getContentAsByteArray()).get("message"));
            assertTrue(response.getContentType().startsWith("application/json"));
        }
        assertEquals(1, hits.get());
        var health = new MockHttpServletRequest("GET", "/api/health");
        filter.doFilter(health, new MockHttpServletResponse(), (r, s) -> hits.incrementAndGet());
        assertEquals(2, hits.get());
    }

    @Test void oversizedDeclaredAndChunkedBodiesNeverReachController() throws Exception {
        var filter = filter(20, 4, 1024);
        for (boolean unknownLength : new boolean[]{false, true}) {
            var request = new MockHttpServletRequest("POST", "/api/chat") {
                @Override public long getContentLengthLong() { return unknownLength ? -1 : super.getContentLengthLong(); }
                @Override public int getContentLength() { return unknownLength ? -1 : super.getContentLength(); }
            };
            request.setContentType("application/json");
            request.setContent("x".repeat(1025).getBytes(StandardCharsets.UTF_8));
            var response = new MockHttpServletResponse();
            filter.doFilter(request, response, (r, s) -> fail("oversized body reached controller"));
            assertEquals(413, response.getStatus());
        }
    }

    @Test void smallUtf8BodyIsPreservedAndMultipartIsNotConsumed() throws Exception {
        var filter = filter(20, 4, 1024);
        var request = request("/api/chat");
        byte[] body = "{\"你好\":\"世界\"}".getBytes(StandardCharsets.UTF_8);
        request.setContent(body);
        filter.doFilter(request, new MockHttpServletResponse(), (r, s) ->
                assertArrayEquals(body, r.getInputStream().readAllBytes()));
        var multipart = request("/api/audio/transcriptions");
        multipart.setContentType("multipart/form-data; boundary=test");
        byte[] audio = new byte[2048];
        multipart.setContent(audio);
        filter.doFilter(multipart, new MockHttpServletResponse(), (r, s) -> {
            assertSame(multipart, r);
            assertArrayEquals(audio, r.getInputStream().readAllBytes());
        });
    }

    @Test void exceptionsReleaseConcurrencyPermit() throws Exception {
        var filter = filter(20, 1, 1024);
        assertThrows(ServletException.class, () -> filter.doFilter(request("/api/chat"),
                new MockHttpServletResponse(), (r, s) -> { throw new ServletException("test"); }));
        var hits = new AtomicInteger();
        filter.doFilter(request("/api/chat"), new MockHttpServletResponse(), (r, s) -> hits.incrementAndGet());
        assertEquals(1, hits.get());
    }

    @Test void streamingRequestsHoldPermitUntilAsyncCompletion() throws Exception {
        var filter = filter(20, 1, 1024);
        var first = request("/api/chat/stream");
        first.setAsyncSupported(true);
        filter.doFilter(first, new MockHttpServletResponse(), (r, s) -> r.startAsync(r, s));
        var context = (MockAsyncContext) first.getAsyncContext();
        assertEquals(1, context.getListeners().size());
        var denied = new MockHttpServletResponse();
        filter.doFilter(request("/api/chat"), denied, (r, s) -> fail("parallel request admitted"));
        assertEquals(429, denied.getStatus());
        for (var listener : context.getListeners()) listener.onTimeout(new AsyncEvent(context));
        var stillDenied = new MockHttpServletResponse();
        filter.doFilter(request("/api/chat"), stillDenied, (r, s) -> fail("timeout released too early"));
        assertEquals(429, stillDenied.getStatus());
        context.complete();
        var hits = new AtomicInteger();
        filter.doFilter(request("/api/chat"), new MockHttpServletResponse(), (r, s) -> hits.incrementAndGet());
        assertEquals(1, hits.get());
    }
}
