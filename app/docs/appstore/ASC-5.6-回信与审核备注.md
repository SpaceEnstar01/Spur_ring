# App Store 5.6 回信 + Review Notes（可直接复制）

> 用途：应对 Guideline 5.6 拒审后的重提。  
> 位置：全部在 [App Store Connect](https://appstoreconnect.apple.com) 操作。  
> 使用前：把文中 `[VIDEO_CONNECT_URL]` / `[VIDEO_FULL_URL]` 换成真实链接（YouTube 未列出 / 网盘「有链接可看」）。

---

## 一、在哪里粘贴

### A. 回复 App 审核（针对 5.6 拒信）

1. App Store Connect → 你的 App → **App 审核** / 被拒版本通知
2. 点 **「回复 App 审核」 / Reply to App Review**
3. 粘贴下面 **「回信正文」**
4. 有新构建时：先上传并选中新构建，再回复并提交审核

### B. Review Notes（版本页备注，和构建一起提交）

1. **分发** → **iOS App** → 当前版本（如 1.0）
2. 滚到 **App 审核信息** → **备注**
3. 粘贴下面 **「Review Notes」**
4. 确认已选中**新构建** → 保存 → 添加以供审核 / 提交

两处内容保持一致；视频链接两处都可以放。

---

## 二、回信正文（Reply to App Review）— 复制这段

```text
Hello App Review team,

Thank you for the feedback regarding Guideline 5.6.

Spur is the iOS app for Spur, an AI recording ring product. Per our product definition, Spur is a wearable AI voice entry on your hand: capture inspiration and important conversations anytime, then sync to iPhone for transcription, organization, and summaries (“Think it, capture it. Say it, get it done.”). The ring handles on-hand capture and local caching; the iPhone app handles sync, transcripts, and notes. We do not hide features from App Review or ship a different experience for reviewers versus customers.

Recording on the ring requires the physical Spur ring. To allow review without hardware, this build includes clearly labeled SAMPLE items so you can open Records, play audio, and view summary/transcript without a ring. SAMPLE content is marked in the UI and is not a hidden feature set.

How to review without hardware:
1. Open the Records tab — SAMPLE items appear immediately.
2. Open any SAMPLE item to play audio and view summary/transcript.
3. Optionally open the Assistant tab to browse SAMPLE cards.
4. Open Devices to see how users connect a Spur ring (scan/connect needs hardware).

How to connect the Spur ring (when available):
1. Open Devices → Scan for Spur Ring.
2. Select your Spur Ring in the nearby list.
3. Tap Connect, then Sync recordings if needed.

Demo videos:
- Ring connection flow: [VIDEO_CONNECT_URL]
- Full ring + app interaction: [VIDEO_FULL_URL]

No account login is required. No hidden paid features. No review-only switches. Please let us know if you need anything else.
```

---

## 三、Review Notes（App 审核信息 → 备注）— 复制这段

```text
No login required. Please review as a guest.

Spur is the iOS app for the Spur AI recording ring — a wearable AI voice entry for capturing inspiration and conversations, with sync, transcription, and summaries on iPhone. Capture on the ring needs the physical device. This build includes clearly labeled SAMPLE items so you can review list / play / summary / transcript without hardware.

Without hardware:
1. Records → open any SAMPLE item (play + summary/transcript).
2. Assistant → SAMPLE cards are available for review.
3. Devices → connection UI is visible; scan/connect needs the ring.

With hardware:
1. Devices → Scan for Spur Ring.
2. Select Spur Ring → Connect.
3. Sync recordings as needed.

Videos:
- Connection: [https://youtube.com/shorts/V0dF7Fjs-pg?feature=share]
- Full demo: [https://youtube.com/shorts/UwWNqFnnBcM?feature=share]

No hidden features, no review-only mode, no account required.
```

---

## 四、提交前自检

- [ ] 新构建已上传并在版本页选中（含 SAMPLE 文案、设备页去 Debug、图标）  
- [ ] `[VIDEO_CONNECT_URL]` 已换成连接短视频链接（建议 30–60 秒：Scan → Connect）  
- [ ] `[VIDEO_FULL_URL]` 已换成你之前的完整交互视频链接  
- [ ] 回信 + Review Notes 都已粘贴  
- [ ] 商店描述未夸大未交付的 Agent 能力（建议只写连接/同步/列表/转写摘要/样例）  

---

## 五、连接短视频拍什么（可选但强烈建议）

拍 30–60 秒即可，不必重拍全片：

1. 打开 Spur → 进入 Devices
2. 点 Scan for Spur Ring
3. 列表出现 `Spur Ring · …XXXX` → Connect
4. 显示 Connected

单独上传后，把链接填进上面两处的 `[VIDEO_CONNECT_URL]`。