import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ing — AI Chatbot",
  description: "Ing is your everyday AI assistant.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
