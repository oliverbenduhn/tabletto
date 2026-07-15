import { cloneElement, useState, useRef, useEffect, useId } from 'react';

function Menu({ trigger, children }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      requestAnimationFrame(() => menuRef.current?.querySelector('[role="menuitem"]')?.focus());
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMenuKeyDown = event => {
    const items = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + direction + items.length) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {cloneElement(trigger, {
        'aria-expanded': isOpen,
        'aria-controls': menuId,
        ref: triggerRef,
        onClick: event => {
          trigger.props.onClick?.(event);
          setIsOpen(open => !open);
        }
      })}
      {isOpen && (
        <div
          id={menuId}
          role="menu"
          onKeyDown={handleMenuKeyDown}
          // Nach dem MenuItem-Handler schließen. Ein Schließen in der Capture-
          // Phase entfernt den geklickten Button, bevor dessen onClick läuft.
          onClick={() => setIsOpen(false)}
          className="absolute right-0 top-full z-50 mt-2 min-w-[200px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger = false }) {
  return (
    <button
      onClick={onClick}
      role="menuitem"
      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-gray-50 ${
        danger ? 'text-red-600' : 'text-gray-700'
      }`}
    >
      {icon && <span className="text-lg">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

Menu.Item = MenuItem;

export default Menu;
