import { useRef, useState, type ReactNode, type Ref } from "react";
import { LAYER } from "../../lib/layers";
import {
  ChartBreakoutSquare,
  ListBullet,
  MoreHorizontal,
} from "../../ui/icons";
import { Popover } from "../../ui/Popover";

export type VisualMenuItem = {
  label: string;
  run: () => void;
  disabled?: boolean;
};

export type VisualHeaderActions = {
  asText: boolean;
  onToggleText: () => void;
  menu: VisualMenuItem[];
};

function ActionButton({
  label,
  onClick,
  children,
  buttonRef,
  expanded,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  buttonRef?: Ref<HTMLButtonElement>;
  expanded?: boolean;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="visual-action"
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** A visual's title and subtitle, and the app's actions on it. */
export function VisualHeader({
  title,
  subtitle,
  actions,
}: {
  /** Undefined while the title is still streaming in. */
  title: string | undefined;
  subtitle: string | undefined;
  actions: VisualHeaderActions | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  return (
    <figcaption className="visual-head">
      <div className="min-w-0 flex-1">
        {title ? (
          <div className="visual-title">{title}</div>
        ) : (
          <div className="visual-title-skeleton" aria-hidden="true" />
        )}
        {subtitle ? <div className="visual-subtitle">{subtitle}</div> : null}
      </div>
      {actions ? (
        <div className="visual-actions">
          <ActionButton
            label={actions.asText ? "View as visual" : "View as text"}
            onClick={actions.onToggleText}
          >
            {actions.asText ? (
              <ChartBreakoutSquare size={15} strokeWidth={1.6} />
            ) : (
              <ListBullet size={15} strokeWidth={1.6} />
            )}
          </ActionButton>
          <ActionButton
            label="More"
            buttonRef={menuButton}
            expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontal size={15} strokeWidth={1.6} />
          </ActionButton>
        </div>
      ) : null}
      {actions && menuOpen ? (
        <Popover
          anchor={menuButton}
          side="bottom"
          align="end"
          width={176}
          layer={LAYER.popover}
          autoFocus
          role="menu"
          aria-label="Visual actions"
          onDismiss={() => setMenuOpen(false)}
          className="p-1"
        >
          {actions.menu.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="visual-menu-item"
              disabled={item.disabled}
              onClick={() => {
                setMenuOpen(false);
                item.run();
              }}
            >
              {item.label}
            </button>
          ))}
        </Popover>
      ) : null}
    </figcaption>
  );
}
