import type { HTMLAttributes, ReactNode } from "react";

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  elevated?: boolean;
};

export default function Surface({ children, elevated = false, className = "", ...props }: SurfaceProps) {
  return (
    <div className={`${elevated ? "app-card-strong" : "app-card"} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
