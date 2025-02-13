import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowDown } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (container.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling) return;
      currentY.current = e.touches[0].clientY;
      const diff = currentY.current - startY.current;
      if (diff > 0) {
        e.preventDefault();
        setPullProgress(Math.min(diff / 100, 1));
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling) return;
      if (pullProgress >= 1) {
        await onRefresh();
      }
      setIsPulling(false);
      setPullProgress(0);
    };

    container.addEventListener("touchstart", handleTouchStart);
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isPulling, pullProgress, onRefresh]);

  return (
    <div ref={containerRef} className="h-full overflow-y-auto relative">
      {isPulling && (
        <div
          className={cn(
            "absolute left-0 right-0 flex items-center justify-center transition-transform",
            "h-16 -translate-y-full",
          )}
          style={{ transform: `translateY(${pullProgress * 100}%)` }}
        >
          <ArrowDown
            className="h-6 w-6 text-muted-foreground transition-transform"
            style={{ transform: `rotate(${pullProgress * 180}deg)` }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
