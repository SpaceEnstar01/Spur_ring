package com.suprring.yanqiang;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import com.facebook.react.bridge.*;
import java.io.File;

/** Foreground-only microphone capture. Audio stays in the app's private directory. */
public class PhoneAudioModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
    private MediaRecorder recorder;
    private MediaPlayer player;
    private File pending;
    private long started;
    private String failure;
    public PhoneAudioModule(ReactApplicationContext context) {
        super(context); context.addLifecycleEventListener(this);
    }
    @Override public String getName() { return "PhoneAudio"; }
    @ReactMethod public synchronized void start(Promise promise) {
        if (getReactApplicationContext().checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            promise.reject("PERMISSION", "请在系统设置中允许麦克风权限"); return;
        }
        if (pending != null) { promise.reject("BUSY", "请先结束当前录音"); return; }
        stopPlayer();
        started = System.currentTimeMillis(); failure = null;
        File folder = new File(getReactApplicationContext().getFilesDir(), "voice-recordings");
        folder.mkdirs(); pending = new File(folder, "phone-" + started + ".m4a");
        try {
            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioSamplingRate(16000); recorder.setAudioChannels(1); recorder.setAudioEncodingBitRate(32000);
            recorder.setMaxDuration(600000); recorder.setMaxFileSize(20L * 1024 * 1024);
            recorder.setOutputFile(pending.getAbsolutePath());
            recorder.setOnInfoListener((r, what, extra) -> { synchronized (this) { finish(); } });
            recorder.setOnErrorListener((r, what, extra) -> { synchronized (this) { failure = "录音被中断，请重新录制"; finish(); } });
            recorder.prepare(); recorder.start(); promise.resolve(null);
        } catch (Exception e) { discard(); promise.reject("RECORD", "无法启动录音，请检查麦克风是否被占用"); }
    }
    private void finish() {
        if (recorder == null) return;
        try { recorder.stop(); } catch (RuntimeException e) { failure = "录音过短或已中断，请重新录制"; }
        finally { recorder.release(); recorder = null; }
    }
    @ReactMethod public synchronized void stop(Promise promise) {
        finish();
        if (pending == null || failure != null || pending.length() == 0) {
            String message = failure == null ? "没有有效录音，请重新录制" : failure;
            discard(); promise.reject("RECORD", message); return;
        }
        WritableMap result = Arguments.createMap();
        result.putString("name", pending.getName()); result.putString("uri", "file://" + pending.getAbsolutePath());
        result.putDouble("size", pending.length()); result.putDouble("timestamp", started);
        result.putString("source", "phone"); pending = null; promise.resolve(result);
    }
    private void discard() { finish(); if (pending != null) pending.delete(); pending = null; failure = null; }
    @ReactMethod public synchronized void cancel(Promise promise) { discard(); promise.resolve(null); }
    @ReactMethod public synchronized void play(String uri, Promise promise) {
        if (pending != null) { promise.reject("BUSY", "请先结束录音"); return; }
        stopPlayer();
        try {
            File file = new File(android.net.Uri.parse(uri).getPath()).getCanonicalFile();
            File folder = new File(getReactApplicationContext().getFilesDir(), "voice-recordings").getCanonicalFile();
            if (!folder.equals(file.getParentFile()) || !file.isFile()) throw new Exception();
            player = new MediaPlayer(); player.setDataSource(file.getAbsolutePath()); player.prepare(); player.start();
            player.setOnCompletionListener(p -> { synchronized (this) { stopPlayer(); } });
            promise.resolve(null);
        } catch (Exception e) { stopPlayer(); promise.reject("PLAY", "无法播放本地录音"); }
    }
    private void stopPlayer() { if (player != null) { player.release(); player = null; } }
    @ReactMethod public synchronized void stopPlayback() { stopPlayer(); }
    @ReactMethod public synchronized void deleteRecording(String uri, Promise promise) {
        try {
            android.net.Uri parsed = android.net.Uri.parse(uri);
            if (!"file".equals(parsed.getScheme()) || (parsed.getAuthority() != null && !parsed.getAuthority().isEmpty()) || parsed.getPath() == null) throw new Exception();
            File file = new File(parsed.getPath()).getCanonicalFile();
            File folder = new File(getReactApplicationContext().getFilesDir(), "voice-recordings").getCanonicalFile();
            if (!folder.equals(file.getParentFile()) || file.isDirectory() || (pending != null && file.equals(pending.getCanonicalFile()))) throw new Exception();
            stopPlayer();
            if (file.exists() && !file.delete()) { promise.reject("DELETE", "录音删除失败，请重试"); return; }
            promise.resolve(null);
        } catch (Exception e) { promise.reject("DELETE", "只能删除已保存的本机录音"); }
    }
    @Override public synchronized void onHostPause() { finish(); stopPlayer(); }
    @Override public void onHostResume() {}
    @Override public synchronized void onHostDestroy() { discard(); stopPlayer(); }
    @Override public void invalidate() { onHostDestroy(); getReactApplicationContext().removeLifecycleEventListener(this); super.invalidate(); }
}
