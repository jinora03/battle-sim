import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from 'react';

interface HorizontalDragScrollState<T extends HTMLElement> {
  ref: RefObject<T | null>;
  overflow: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  dragging: boolean;
  onPointerDown(event: ReactPointerEvent<T>): void;
  onPointerMove(event: ReactPointerEvent<T>): void;
  onPointerUp(event: ReactPointerEvent<T>): void;
  onPointerCancel(event: ReactPointerEvent<T>): void;
  onLostPointerCapture(event: ReactPointerEvent<T>): void;
  onClickCapture(event: ReactMouseEvent<T>): void;
}

export function useHorizontalDragScroll<T extends HTMLElement>(): HorizontalDragScrollState<T> {
  const ref = useRef<T | null>(null);
  const dragRef = useRef({ pointerId: -1, startX: 0, startScrollLeft: 0, moved: false });
  const [overflowState, setOverflowState] = useState({
    overflow: false,
    canScrollLeft: false,
    canScrollRight: false
  });
  const [dragging, setDragging] = useState(false);

  const refreshOverflow = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    setOverflowState({
      overflow: maxScrollLeft > 2,
      canScrollLeft: element.scrollLeft > 2,
      canScrollRight: element.scrollLeft < maxScrollLeft - 2
    });
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refreshOverflow);
    observer?.observe(element);
    for (const child of Array.from(element.children)) observer?.observe(child);
    element.addEventListener('scroll', refreshOverflow, { passive: true });
    window.addEventListener('resize', refreshOverflow, { passive: true });
    refreshOverflow();
    return () => {
      observer?.disconnect();
      element.removeEventListener('scroll', refreshOverflow);
      window.removeEventListener('resize', refreshOverflow);
    };
  }, [refreshOverflow]);

  const finishDrag = useCallback((event: ReactPointerEvent<T>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current.pointerId = -1;
    setDragging(false);
    refreshOverflow();
  }, [refreshOverflow]);

  const onPointerDown = useCallback((event: ReactPointerEvent<T>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const element = event.currentTarget;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: element.scrollLeft,
      moved: false
    };
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<T>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - dragRef.current.startX;
    if (Math.abs(deltaX) > 4 && !dragRef.current.moved) {
      dragRef.current.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    if (!dragRef.current.moved) return;
    event.preventDefault();
    event.currentTarget.scrollLeft = dragRef.current.startScrollLeft - deltaX;
    refreshOverflow();
  }, [refreshOverflow]);

  const onClickCapture = useCallback((event: ReactMouseEvent<T>) => {
    if (!dragRef.current.moved) return;
    dragRef.current.moved = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return {
    ref,
    ...overflowState,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onLostPointerCapture: finishDrag,
    onClickCapture
  };
}
