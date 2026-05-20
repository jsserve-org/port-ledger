import "./styles.css";

export const metadata = {
  title: "Port Ledger",
  description: "Scan TCP ports and track added or removed open ports."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
