import { useRef, type KeyboardEvent } from "react";
import { Icon } from "./Icon";
export function TaskInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  compact = false,
}: {
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function key(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      if (value.trim() && !disabled) onSubmit();
    }
  }
  return (
    <form
      className={`task-input ${compact ? "task-input-compact" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() && !disabled) onSubmit();
      }}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
        }}
        onKeyDown={key}
        rows={compact ? 2 : 3}
        maxLength={12000}
        placeholder={
          compact
            ? "补充需求，交给 Spur 继续推进…"
            : "Ask Spur to research, analyze, create or get things done…"
        }
        aria-label="任务需求"
      />
      <div className="input-bottom">
        <span>
          <Icon name="spark" size={15} />
          {compact ? "基于当前任务继续" : "Agent Mode"}
        </span>
        <button
          type="submit"
          className="send-task"
          disabled={!value.trim() || disabled}
          aria-label="提交任务"
        >
          <Icon name="send" size={19} />
        </button>
      </div>
    </form>
  );
}
