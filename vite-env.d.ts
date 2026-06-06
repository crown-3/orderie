// SVG files are imported as React components via @svgr/webpack (see next.config.ts).
declare module "*.svg" {
  import * as React from "react";
  const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}
