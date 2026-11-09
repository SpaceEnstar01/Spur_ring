package com.suprring.chat;
public class ChatFailure extends RuntimeException {
    public final int status;
    public ChatFailure(int status, String message) { super(message); this.status = status; }
}
