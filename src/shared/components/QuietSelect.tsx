import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export interface QuietSelectOption<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface QuietSelectProps<T extends string | number> {
  value: T;
  options: Array<QuietSelectOption<T>>;
  onChange: (value: T) => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

interface SelectMenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "top" | "bottom";
}

const MENU_GAP = 6;
const VIEWPORT_PADDING = 8;
const DEFAULT_MENU_MAX_HEIGHT = 220;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function QuietSelect<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  className,
}: QuietSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [menuPosition, setMenuPosition] = useState<SelectMenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const listboxId = useId();

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    setMenuPosition(null);
    if (restoreFocus) {
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  };

  const resolveMenuPosition = (measuredHeight?: number): SelectMenuPosition | null => {
    const trigger = triggerRef.current;
    if (!trigger) return null;

    const rect = trigger.getBoundingClientRect();
    const menuHeight = measuredHeight ?? listRef.current?.offsetHeight ?? DEFAULT_MENU_MAX_HEIGHT;
    const width = Math.max(rect.width, 120);
    const belowTop = rect.bottom + MENU_GAP;
    const aboveTop = rect.top - menuHeight - MENU_GAP;
    const spaceBelow = window.innerHeight - belowTop - VIEWPORT_PADDING;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_PADDING;
    const shouldFlip = spaceBelow < menuHeight && spaceAbove > spaceBelow;
    const availableSpace = Math.max(shouldFlip ? spaceAbove : spaceBelow, 96);
    const maxHeight = Math.min(DEFAULT_MENU_MAX_HEIGHT, availableSpace);
    const top = shouldFlip
      ? clamp(aboveTop, VIEWPORT_PADDING, window.innerHeight - maxHeight - VIEWPORT_PADDING)
      : clamp(belowTop, VIEWPORT_PADDING, window.innerHeight - maxHeight - VIEWPORT_PADDING);
    const left = clamp(rect.left, VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING);

    return {
      top,
      left,
      width,
      maxHeight,
      placement: shouldFlip ? "top" : "bottom",
    };
  };

  const updateMenuPosition = (measuredHeight?: number) => {
    const nextPosition = resolveMenuPosition(measuredHeight);
    if (!nextPosition) return;
    setMenuPosition((current) => {
      if (
        current
        && Math.abs(current.top - nextPosition.top) < 1
        && Math.abs(current.left - nextPosition.left) < 1
        && Math.abs(current.width - nextPosition.width) < 1
        && Math.abs(current.maxHeight - nextPosition.maxHeight) < 1
        && current.placement === nextPosition.placement
      ) {
        return current;
      }
      return nextPosition;
    });
  };

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition(listRef.current?.offsetHeight);
    return undefined;
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return undefined;
    const handleViewportChange = () => {
      updateMenuPosition(listRef.current?.offsetHeight);
    };
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setHighlightedIndex(-1);
      return;
    }
    const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : options.findIndex((option) => !option.disabled));
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      updateMenuPosition(listRef.current?.offsetHeight);
      listRef.current?.focus();
    });
  }, [open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((current) => !current);
      return;
    }
    if (event.key === "Escape") {
      closeMenu();
    }
  };

  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === "Tab") {
      closeMenu();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    const enabledIndexes = options
      .map((option, index) => ({ option, index }))
      .filter((item) => !item.option.disabled)
      .map((item) => item.index);
    if (enabledIndexes.length === 0) {
      return;
    }
    const currentPos = enabledIndexes.indexOf(highlightedIndex);
    if (event.key === "ArrowDown") {
      const nextPos = currentPos < 0 ? 0 : (currentPos + 1) % enabledIndexes.length;
      setHighlightedIndex(enabledIndexes[nextPos]);
      return;
    }
    if (event.key === "ArrowUp") {
      const nextPos = currentPos < 0 ? enabledIndexes.length - 1 : (currentPos - 1 + enabledIndexes.length) % enabledIndexes.length;
      setHighlightedIndex(enabledIndexes[nextPos]);
      return;
    }
    const nextIndex = highlightedIndex >= 0 ? highlightedIndex : enabledIndexes[0];
    const target = options[nextIndex];
    if (target && !target.disabled) {
      onChange(target.value);
      closeMenu(true);
    }
  };

  const menuStyle: CSSProperties | undefined = menuPosition
    ? {
      top: `${menuPosition.top}px`,
      left: `${menuPosition.left}px`,
      width: `${menuPosition.width}px`,
      maxHeight: `${menuPosition.maxHeight}px`,
    }
    : { visibility: "hidden" };

  const menu = open ? (
    <ul
      ref={listRef}
      id={listboxId}
      role="listbox"
      tabIndex={-1}
      aria-labelledby={`${listboxId}-trigger`}
      aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined}
      onKeyDown={handleListKeyDown}
      className={`qp-select-menu qp-select-menu-${menuPosition?.placement ?? "bottom"}`}
      style={menuStyle}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        const highlighted = index === highlightedIndex;
        return (
          <li
            key={String(option.value)}
            id={`${listboxId}-option-${index}`}
            role="option"
            aria-selected={selected}
          >
            <button
              type="button"
              tabIndex={-1}
              disabled={option.disabled}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => {
                if (option.disabled) return;
                onChange(option.value);
                closeMenu(true);
              }}
              className={`qp-select-option ${selected ? "qp-select-option-selected" : ""} ${highlighted ? "qp-select-option-highlighted" : ""}`}
            >
              {option.label}
            </button>
          </li>
        );
      })}
    </ul>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`qp-select-root ${className ?? ""}`}
    >
      <button
        ref={triggerRef}
        type="button"
        id={`${listboxId}-trigger`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        className="qp-control qp-select-trigger"
      >
        <span className="truncate">{selectedOption?.label ?? ""}</span>
        <ChevronDown size={14} className={`qp-select-caret ${open ? "qp-select-caret-open" : ""}`} />
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
