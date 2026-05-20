# Port Ledger

A small Next.js app that scans a target IP address or hostname, displays open TCP ports, and keeps a history of ports added or removed between scans.

Protected rows are redacted by server route handlers. The browser does not receive protected port details until the password is verified and the server sets an HTTP-only cookie.

## Run

```bash
npm start
```

Then open:

```text
http://127.0.0.1:3000
```

## Password

Each open-port row has a switch. Turning it off stores that row as protected on the server. Unauthenticated requests receive a redacted item instead of the port details.

The default unlock password is:

```text
admin123
```

Change it when starting the app:

```bash
SCAN_PASSWORD="your-password" npm start
```

For production, also set a stable signing secret:

```bash
AUTH_SECRET="long-random-string" SCAN_PASSWORD="your-password" npm start
```

## Ports

Leave the ports field empty to scan common service ports, or enter a custom list:

```text
22,80,443,8000-8080
```
