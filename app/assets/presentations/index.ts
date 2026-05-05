import type { StaticImageData } from "next/image";

type ImageModule = StaticImageData | { default: StaticImageData };

// Auto-discover all images in this directory at build time via webpack require.context.
// To add a slide: drop an image file here. No code changes needed.
const ctx = (require as unknown as {
  context(dir: string, deep: boolean, filter: RegExp): {
    keys(): string[];
    (id: string): ImageModule;
  };
}).context(".", false, /\.(png|jpg|jpeg|webp)$/i);

function resolveImage(mod: ImageModule): StaticImageData {
  return "default" in mod ? (mod as { default: StaticImageData }).default : (mod as StaticImageData);
}

const entries = ctx
  .keys()
  .map((key) => ({
    name: key.replace(/^\.\//, "").replace(/\.(png|jpg|jpeg|webp)$/i, ""),
    image: resolveImage(ctx(key)),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

export const PRESENTATION_IMAGE_KEYS: string[] = entries.map((e) => e.name);
export const PRESENTATION_IMAGES: Record<string, StaticImageData> = Object.fromEntries(
  entries.map((e) => [e.name, e.image]),
);
