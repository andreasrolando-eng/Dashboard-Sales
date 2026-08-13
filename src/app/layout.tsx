import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";

export const metadata: Metadata = {
  title: "ESB Analytics",
  description: "Monitoring sales & membership F&B",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-page-bg text-text">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
