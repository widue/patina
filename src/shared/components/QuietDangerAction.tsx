import type { ReactNode } from "react";
import QuietTooltip from "./QuietTooltip";

interface Props {
  children: ReactNode;
  disabled?: boolean;
  title?: string;
  leadingIcon?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function QuietDangerAction({
  children,
  disabled = false,
  title,
  leadingIcon,
  className,
  onClick,
}: Props) {
  const button = (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`qp-danger-action ${className ?? ""}`.trim()}
    >
      {leadingIcon}
      {children}
    </button>
  );

  if (!title) {
    return button;
  }

  return (
    <QuietTooltip label={title}>
      {button}
    </QuietTooltip>
  );
}
