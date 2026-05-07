import type { HTMLAttributes, ReactNode } from "react";

type Elevation = "flat" | "raised" | "overlay";

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  elevated?: boolean;
  elevation?: Elevation;
};

const elevationMap: Record<Elevation, string> = {
  flat: "app-card",
  raised: "app-card-strong",
  overlay: "app-card-strong shadow-xl",
};

export default function Surface({
  children,
  elevated = false,
  elevation,
  className = "",
  ...props
}: SurfaceProps) {
  const tier = elevation ?? (elevated ? "raised" : "flat");
  return (
    <div className={`${elevationMap[tier]} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
