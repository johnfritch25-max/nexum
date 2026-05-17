/**
 * useDraggable.ts
 * Makes a modal draggable on desktop (md+) by dragging its header.
 *
 * Uses a ref callback to set CSS custom properties directly on the DOM node,
 * avoiding inline style props (which trigger linter warnings).
 *
 * Usage:
 *   const { modalRef, dragHandleProps } = useDraggable();
 *   <div ref={modalRef}>
 *     <div {...dragHandleProps}>Header — drag me</div>
 *   </div>
 *
 * Add to your CSS:
 *   .draggable-modal { translate: var(--drag-x, -50%) var(--drag-y, -50%); }
 */

import { useCallback, useRef, useEffect } from 'react';

interface Position { x: number; y: number }

const ZERO: Position = { x: 0, y: 0 };

export interface UseDraggableReturn {
    /** Attach to the modal root element */
    modalRef: (el: HTMLElement | null) => void;
    /** Spread onto the drag handle element (header bar) */
    dragHandleProps: {
        onMouseDown: (e: React.MouseEvent) => void;
        className:   string;
    };
}

export function useDraggable(): UseDraggableReturn {
    const nodeRef    = useRef<HTMLElement | null>(null);
    const dragging   = useRef(false);
    const startMouse = useRef<Position>(ZERO);
    const currentPos = useRef<Position>(ZERO);

    /** Apply position to the DOM node via CSS custom properties */
    const applyPos = useCallback((pos: Position) => {
        const el = nodeRef.current;
        if (!el) return;
        // Only apply on md+ (≥768px)
        if (window.innerWidth < 768) return;
        el.style.setProperty('--drag-x', `calc(-50% + ${pos.x}px)`);
        el.style.setProperty('--drag-y', `calc(-50% + ${pos.y}px)`);
        el.style.translate = `var(--drag-x) var(--drag-y)`;
    }, []);

    const modalRef = useCallback((el: HTMLElement | null) => {
        nodeRef.current = el;
        if (el) applyPos(currentPos.current);
    }, [applyPos]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if (window.innerWidth < 768) return;
        // Don't drag when clicking interactive elements inside the header
        if ((e.target as HTMLElement).closest('button, input, textarea, select, a')) return;

        dragging.current   = true;
        startMouse.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
    }, []);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragging.current) return;
            const dx = e.clientX - startMouse.current.x;
            const dy = e.clientY - startMouse.current.y;
            const next: Position = {
                x: currentPos.current.x + dx,
                y: currentPos.current.y + dy,
            };
            // Update start so delta is relative to last frame
            startMouse.current = { x: e.clientX, y: e.clientY };
            currentPos.current = next;
            applyPos(next);
        };

        const onUp = () => { dragging.current = false; };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup',   onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup',   onUp);
        };
    }, [applyPos]);

    return {
        modalRef,
        dragHandleProps: {
            onMouseDown,
            // Show grab cursor on desktop only — use a CSS class so no inline style
            className: 'md:cursor-grab md:active:cursor-grabbing select-none',
        },
    };
}
