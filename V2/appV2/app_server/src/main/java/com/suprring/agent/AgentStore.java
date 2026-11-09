package com.suprring.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.suprring.chat.ChatFailure;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;
import java.sql.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import java.util.function.Function;

/** Small-beta aggregate store: SQL row locks serialize each owner's state, including event history. */
@Repository
@ConditionalOnProperty(name="spur.agent.enabled", havingValue="true")
public class AgentStore {
    private final String url, user, password;
    private final ObjectMapper json;
    private final SecureRandom random = new SecureRandom();
    public AgentStore(ObjectMapper mapper, @Value("${spur.agent.jdbc-url}") String url,
                      @Value("${spur.agent.jdbc-user}") String user, @Value("${spur.agent.jdbc-password}") String password) {
        if ((!url.startsWith("jdbc:h2:file:") && !url.startsWith("jdbc:postgresql:")) && !url.startsWith("jdbc:h2:mem:spur-test"))
            throw new IllegalStateException("Agent requires an explicit persistent JDBC URL (H2 file + PVC, or PostgreSQL)");
        this.url = url; this.user = user; this.password = password;
        this.json = mapper.copy().disable(com.fasterxml.jackson.databind.MapperFeature.USE_ANNOTATIONS);
        try (var c = connect(); var s = c.createStatement()) {
            s.execute("CREATE TABLE IF NOT EXISTS spur_agent_devices (id VARCHAR(36) PRIMARY KEY, token_hash VARCHAR(64) NOT NULL UNIQUE, created_at BIGINT NOT NULL)");
            s.execute("CREATE TABLE IF NOT EXISTS spur_agent_workspaces (owner VARCHAR(36) PRIMARY KEY, version BIGINT NOT NULL, body TEXT NOT NULL)");
        } catch (SQLException e) { throw new IllegalStateException("Agent durable database unavailable", e); }
    }
    private Connection connect() throws SQLException { return DriverManager.getConnection(url, user, password); }
    public static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    public String secret() {
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    public Map<String, String> enroll() {
        String id = AgentData.id(), token = secret();
        try (var c = connect()) {
            c.setAutoCommit(false);
            try {
                try (var p = c.prepareStatement("INSERT INTO spur_agent_devices VALUES (?, ?, ?)")) {
                    p.setString(1, id); p.setString(2, hash(token)); p.setLong(3, System.currentTimeMillis()); p.executeUpdate();
                }
                try (var p = c.prepareStatement("INSERT INTO spur_agent_workspaces VALUES (?, ?, ?)")) {
                    p.setString(1, id); p.setLong(2, 0); p.setString(3, json.writeValueAsString(new AgentData.Workspace())); p.executeUpdate();
                }
                c.commit();
                return Map.of("deviceId", id, "token", token);
            } catch (Exception e) { c.rollback(); throw e; }
        } catch (Exception e) { throw new ChatFailure(503, "设备身份创建失败，请稍后重试"); }
    }
    public String authenticate(String authorization) {
        if (authorization == null || !authorization.matches("Bearer [A-Za-z0-9_-]{43}")) throw new ChatFailure(401, "请先建立本机安全身份");
        try (var c = connect(); var p = c.prepareStatement("SELECT id FROM spur_agent_devices WHERE token_hash=?")) {
            p.setString(1, hash(authorization.substring(7)));
            try (var r = p.executeQuery()) {
                if (r.next()) return r.getString(1);
                throw new ChatFailure(401, "设备身份已失效，未读取其他用户数据");
            }
        } catch (SQLException e) { throw new ChatFailure(503, "身份服务暂不可用"); }
    }
    public <T> T change(String owner, Function<AgentData.Workspace, T> operation) {
        try (var c = connect()) {
            c.setAutoCommit(false);
            try {
                AgentData.Workspace state;
                long version;
                try (var p = c.prepareStatement("SELECT body, version FROM spur_agent_workspaces WHERE owner=? FOR UPDATE")) {
                    p.setString(1, owner);
                    try (var r = p.executeQuery()) {
                        if (!r.next()) throw new ChatFailure(401, "设备身份已失效");
                        state = json.readValue(r.getString(1), AgentData.Workspace.class); version = r.getLong(2);
                    }
                }
                if (state.schemaVersion != 1) throw new ChatFailure(503, "Agent 数据版本不兼容，已停止执行");
                T result = operation.apply(state);
                state.version = version + 1;
                try (var p = c.prepareStatement("UPDATE spur_agent_workspaces SET body=?, version=? WHERE owner=? AND version=?")) {
                    p.setString(1, json.writeValueAsString(state)); p.setLong(2, state.version); p.setString(3, owner); p.setLong(4, version);
                    if (p.executeUpdate() != 1) throw new ChatFailure(409, "状态已更新，请刷新");
                }
                c.commit(); return result;
            } catch (Exception e) { c.rollback(); throw e; }
        } catch (ChatFailure e) { throw e; }
        catch (Exception e) { throw new ChatFailure(503, "Agent 状态未保存，操作已停止"); }
    }
    public record Pending(String owner, String recordId, long receivedAt) {}
    /** The durable capture itself is the beta queue; no transient in-memory job is authoritative. */
    public List<Pending> pendingInterpretations() {
        var pending = new ArrayList<Pending>();
        long abandonedBefore = System.currentTimeMillis() - 180000;
        try (var c = connect(); var p = c.prepareStatement("SELECT owner, body FROM spur_agent_workspaces");
             var rows = p.executeQuery()) {
            while (rows.next()) {
                var w = json.readValue(rows.getString(2), AgentData.Workspace.class);
                String owner = rows.getString(1);
                for (var r : w.records) if ((r.status.equals("received")
                        || (r.status.equals("interpreting") && r.interpretingSince < abandonedBefore))
                        && w.records.stream().noneMatch(newer -> Objects.equals(newer.clientId, r.clientId) && newer.revision > r.revision)) {
                    pending.add(new Pending(owner, r.id, r.receivedAt));
                }
            }
        } catch (Exception e) { throw new ChatFailure(503, "Agent 待处理记录暂不可用"); }
        return pending.stream().sorted(Comparator.comparingLong(Pending::receivedAt)).limit(8).toList();
    }
    public AgentData.Workspace read(String owner) {
        try (var c = connect(); var p = c.prepareStatement("SELECT body FROM spur_agent_workspaces WHERE owner=?")) {
            p.setString(1, owner);
            try (var r = p.executeQuery()) {
                if (!r.next()) throw new ChatFailure(401, "设备身份已失效");
                return json.readValue(r.getString(1), AgentData.Workspace.class);
            }
        } catch (ChatFailure e) { throw e; }
        catch (Exception e) { throw new ChatFailure(503, "Agent 状态暂不可用"); }
    }
}
