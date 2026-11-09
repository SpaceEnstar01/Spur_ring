import { useEffect, useRef, type ReactNode } from "react";
export function DetailDrawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const elements = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button,a[href],textarea,input,[tabindex="0"]'
          ) || []
        );
        const first = elements[0],
          last = elements[elements.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="detail-layer">
      <button className="detail-veil" aria-label="关闭详情" onClick={onClose} />
      <section
        ref={ref}
        tabIndex={-1}
        className="detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <span>{title}</span>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="关闭详情"
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
