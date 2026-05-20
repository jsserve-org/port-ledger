import { Orbitron, Space_Mono } from "next/font/google";
import "./styles.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "700", "900"],
  display: "swap"
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
  display: "swap"
});

export const metadata = {
  title: "Port Ledger — Network Exposure Monitor",
  description: "Scan TCP ports and track added or removed open ports across your network."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${orbitron.variable} ${spaceMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
