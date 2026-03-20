import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orderie",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <script src="https://cdn.jsdelivr.net/npm/eruda" />
        <script dangerouslySetInnerHTML={{ __html: "eruda.init();" }} />
      </body>
    </html>
  );
}
