"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Option = { value: string; label: string; disabled?: boolean };

type SelectProps = {
  id?: string;
  name?: string;
  value: string;
  options: Option[];
  onValueChange: (value: string) => void;
  selectedLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "plain";
  "aria-label"?: string;
};

export function Select({
  id,
  name,
  value,
  options,
  onValueChange,
  selectedLabel,
  placeholder = "Select an option",
  disabled = false,
  className = "",
  variant = "default",
  "aria-label": ariaLabel,
}: SelectProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listId = `${triggerId}-options`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const expanded = open && !disabled;
  const selected = options.find((option) => option.value === value);
  const enabled = options.flatMap((option, index) =>
    option.disabled ? [] : [index],
  );

  function show(last = false) {
    const selectedIndex = options.findIndex(
      (option) => option.value === value && !option.disabled,
    );
    setActive(
      selectedIndex >= 0
        ? selectedIndex
        : ((last ? enabled.at(-1) : enabled[0]) ?? -1),
    );
    setPosition(null);
    searchRef.current = { text: "", time: 0 };
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
    onValueChange(option.value);
  }

  useLayoutEffect(() => {
    if (!expanded) return;
    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const below = viewportTop + viewportHeight - rect.bottom - 12;
      const above = rect.top - viewportTop - 12;
      const flip = below < 180 && above > below;
      const maxHeight = Math.max(48, Math.min(280, flip ? above : below));
      const height = Math.min(
        menuRef.current?.scrollHeight ?? maxHeight,
        maxHeight,
      );
      const width = Math.min(Math.max(rect.width, 220), viewportWidth - 24);
      setPosition({
        top: flip ? rect.top - height - 6 : rect.bottom + 6,
        left: Math.max(12, Math.min(rect.left, viewportWidth - width - 12)),
        width,
        maxHeight,
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    function dismiss(event: Event) {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      )
        setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
    };
  }, [expanded]);

  useEffect(() => {
    if (expanded)
      menuRef.current
        ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, expanded]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!expanded) {
        show(event.key === "ArrowUp" || event.key === "End");
      } else if (event.key === "Home") setActive(enabled[0] ?? -1);
      else if (event.key === "End") setActive(enabled.at(-1) ?? -1);
      else {
        const current = enabled.indexOf(active);
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setActive(
          enabled[(current + direction + enabled.length) % enabled.length] ??
            -1,
        );
      }
    } else if (
      event.key === "Enter" ||
      (event.key === " " && !searchRef.current.text)
    ) {
      event.preventDefault();
      if (expanded) choose(active);
      else show();
    } else if (event.key === "Escape") {
      if (expanded) event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab") setOpen(false);
    else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const now = Date.now();
      const text =
        (now - searchRef.current.time < 700 ? searchRef.current.text : "") +
        event.key.toLowerCase();
      searchRef.current = { text, time: now };
      if (!expanded) show();
      searchRef.current = { text, time: now };
      const query = [...text].every((letter) => letter === text[0])
        ? text[0]
        : text;
      const order = [
        ...enabled.filter((index) => index > active),
        ...enabled.filter((index) => index <= active),
      ];
      const match = order.find((index) =>
        options[index].label.toLowerCase().startsWith(query),
      );
      if (match !== undefined) setActive(match);
    }
  }

  return (
    <>
      {name && (
        <input type="hidden" name={name} value={value} disabled={disabled} />
      )}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={expanded}
        aria-haspopup="listbox"
        aria-controls={expanded ? listId : undefined}
        aria-activedescendant={
          expanded && active >= 0 ? `${listId}-${active}` : undefined
        }
        disabled={disabled}
        data-placeholder={!selected || undefined}
        className={`custom-select-trigger ${variant === "plain" ? "custom-select-plain" : "input"} ${className}`}
        onClick={() => (expanded ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span>{selectedLabel ?? selected?.label ?? placeholder}</span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="custom-select-chevron"
        />
      </button>
      {expanded &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabel ? undefined : triggerId}
            className="custom-select-menu"
            style={{ ...position, visibility: position ? "visible" : "hidden" }}
            onPointerDown={(event) => event.preventDefault()}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                data-index={index}
                data-active={active === index || undefined}
                className="custom-select-option"
                onPointerMove={() => !option.disabled && setActive(index)}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {option.value === value && (
                  <Check size={17} aria-hidden="true" />
                )}
              </div>
            ))}
            {!options.length && (
              <div className="custom-select-empty">No options available</div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
