# Laptop / Office / Debug — App Store 1.0 下架备份与恢复说明

> 备份日期：2026-09-12  
> 原因：App Store Guideline 5.6 连续拒审；1.0 审核包去掉易被判定为「隐藏/未完成/调试」的入口。  
> 原则：**源码不删**，只从正式导航与设备页入口断开；随时可恢复。

---

## 1. 本地下架范围（审核包）

| 能力 | 下架方式 | 源码是否保留 |
|------|----------|--------------|
| Connect Laptop（连电脑 / Spur Buddy） | 设备页入口去掉；Stack 不注册 | ✅ 保留 |
| Cloud Office（云端 PDF/PPT） | 设备页入口去掉；Stack 不注册 | ✅ 保留 |
| Button Debug（按键调试） | Stack 不注册 | ✅ 保留 |
| Sync recordings（戒指同步） | **保留**（产品核心，不是调试卖点） | ✅ |

未删除的仓库路径（仍在工程内）：

```text
app/mobile/src/screens/device/ConnectLaptopScreen.tsx
app/mobile/src/screens/office/CloudOfficeScreen.tsx
app/mobile/src/screens/device/YanqiangButtonDebugScreen.tsx
app/mobile/src/services/spurBuddyApi.ts
app/mobile/src/services/officeApi.ts
app/mobile/src/services/officeJob.ts
```

文案 key（`en.ts` / `zh.ts`）也保留：`device.computerSection`、`device.connectLaptop*`、`device.cloudOffice*`、`laptop.*`、`office.*`、`buttonDebug` 等。

---

## 2. 快照副本（本目录旁）

同次备份还复制了一份源文件到：

```text
app/docs/appstore/store/backup-2026-09-12-laptop-office-debug/
  ConnectLaptopScreen.tsx
  CloudOfficeScreen.tsx
  YanqiangButtonDebugScreen.tsx
  spurBuddyApi.ts
  officeApi.ts
  officeJob.ts
```

（相对仓库根目录：`spur/app/docs/appstore/store/backup-2026-09-12-laptop-office-debug/`）

若仓库内源文件被误改，可用上述副本覆盖回 `app/mobile/src/...` 对应路径。

---

## 3. 调整时改动的接线位置

### 3.1 `app/mobile/src/navigation/AppNavigator.tsx`

**下架后：** 不再 `import` / 注册：

- `ConnectLaptop` → `ConnectLaptopScreen`
- `CloudOffice` → `CloudOfficeScreen`
- `YanqiangButtonDebug` → `YanqiangButtonDebugScreen`

**仍注册：**

- `Device` → `YanqiangVoiceDebugScreen`
- `YanqiangRecordingDebug` → `YanqiangRecordingDebugScreen`（同步录音）

### 3.2 `app/mobile/src/screens/device/YanqiangVoiceDebugScreen.tsx`

去掉两段入口 UI（Computer / Cloud documents）。保留已连接后的 **Sync recordings**。

恢复时把下面 JSX 插回 Scan 按钮之后、`connectionState === 'connected'` 工具区之前：

```tsx
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.device.computerSection}</Text>
        <Pressable style={styles.row} onPress={() => navigation.navigate('ConnectLaptop')}>
          <View style={styles.flex}>
            <Text style={styles.rowLabel}>{t.device.connectLaptop}</Text>
            <Text style={styles.rowHint}>{t.device.connectLaptopHint}</Text>
          </View>
          <ChevronRight color={colors.textTertiary} size={18} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.device.cloudOfficeSection}</Text>
        <Pressable style={styles.row} onPress={() => navigation.navigate('CloudOffice')}>
          <View style={styles.flex}>
            <Text style={styles.rowLabel}>{t.device.cloudOffice}</Text>
            <Text style={styles.rowHint}>{t.device.cloudOfficeHint}</Text>
          </View>
          <ChevronRight color={colors.textTertiary} size={18} />
        </Pressable>
      </View>
```

### 3.3 `app/mobile/src/types/navigation.ts`

类型里可继续保留 `ConnectLaptop` / `CloudOffice` / `YanqiangButtonDebug`，方便恢复时少改类型。若曾删掉，恢复导航时一并加回：

```ts
ConnectLaptop: undefined;
CloudOffice: undefined;
YanqiangButtonDebug: { macAddress: string };
```

---

## 4. 如何完整恢复（上架后 / 内测包）

1. 打开 `AppNavigator.tsx`，加回 import：

```ts
import { ConnectLaptopScreen } from '@/screens/device/ConnectLaptopScreen';
import { CloudOfficeScreen } from '@/screens/office/CloudOfficeScreen';
import { YanqiangButtonDebugScreen } from '@/screens/device/YanqiangButtonDebugScreen';
```

2. 在 `Stack.Navigator` 内加回：

```tsx
<Stack.Screen name="ConnectLaptop" component={ConnectLaptopScreen} />
<Stack.Screen name="CloudOffice" component={CloudOfficeScreen} />
<Stack.Screen name="YanqiangButtonDebug" component={YanqiangButtonDebugScreen} />
```

3. 在 `YanqiangVoiceDebugScreen.tsx` 粘回第 3.2 节 JSX。  
4. （可选）若需按键调试入口，在已连接工具区加回 `YanqiangButtonDebug` 导航（仅 `__DEV__` 更稳）。  
5. `cd app/mobile && npm run typecheck`，真机验证连电脑 / 云文档。

---

## 5. 与审核说明的关系

1.0 审核包对外能力收敛为：

- Records（含全员可见的 SAMPLE）
- Assistant（SAMPLE 卡片）
- Devices：扫描 / 连接 Spur Ring + 同步录音
- Me：静态说明

Connect Laptop / Cloud Office / Button Debug **不对审核员展示**，避免再被判「隐藏或未完成功能」。通过后再按第 4 节恢复即可。
