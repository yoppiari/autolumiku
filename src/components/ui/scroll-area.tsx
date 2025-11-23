/**
 * Scroll Area Component
 * shadcn/ui scroll area component
 */

import * as React from "react"

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ScrollArea({ children, className = "", ...props }: ScrollAreaProps) {
  return (
    <div
      className={`relative overflow-auto ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
