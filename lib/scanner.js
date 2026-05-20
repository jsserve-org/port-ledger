import net from "node:net";

export const DEFAULT_PORTS = [
  20, 21, 22, 23, 25, 53, 67, 68, 69, 80, 110, 111, 119, 123, 135, 137, 138,
  139, 143, 161, 162, 179, 389, 443, 445, 465, 500, 514, 515, 587, 631, 636,
  993, 995, 1080, 1433, 1521, 1723, 1883, 2049, 2082, 2083, 2375, 2376, 2483,
  2484, 3000, 3306, 3389, 3690, 4000, 5000, 5432, 5601, 5672, 5900, 5984, 6379,
  6443, 6667, 7001, 8000, 8008, 8080, 8081, 8443, 8888, 9000, 9200, 9300, 9418,
  10000, 11211, 15672, 27017
];

export const SERVICE_NAMES = {
  20: "FTP data",
  21: "FTP",
  22: "SSH",
  23: "Telnet",
  25: "SMTP",
  53: "DNS",
  67: "DHCP",
  68: "DHCP",
  69: "TFTP",
  80: "HTTP",
  110: "POP3",
  111: "RPC bind",
  119: "NNTP",
  123: "NTP",
  135: "MS RPC",
  137: "NetBIOS",
  138: "NetBIOS",
  139: "NetBIOS",
  143: "IMAP",
  161: "SNMP",
  162: "SNMP trap",
  179: "BGP",
  389: "LDAP",
  443: "HTTPS",
  445: "SMB",
  465: "SMTPS",
  500: "IKE",
  514: "Syslog",
  515: "LPD",
  587: "SMTP submission",
  631: "IPP",
  636: "LDAPS",
  993: "IMAPS",
  995: "POP3S",
  1433: "SQL Server",
  1521: "Oracle",
  1723: "PPTP",
  1883: "MQTT",
  2049: "NFS",
  2375: "Docker",
  2376: "Docker TLS",
  3000: "App server",
  3306: "MySQL",
  3389: "RDP",
  5432: "PostgreSQL",
  5601: "Kibana",
  5672: "AMQP",
  5900: "VNC",
  5984: "CouchDB",
  6379: "Redis",
  6443: "Kubernetes API",
  8000: "HTTP alt",
  8008: "HTTP alt",
  8080: "HTTP proxy",
  8081: "HTTP alt",
  8443: "HTTPS alt",
  8888: "HTTP alt",
  9200: "Elasticsearch",
  9300: "Elasticsearch",
  9418: "Git",
  10000: "Webmin",
  11211: "Memcached",
  15672: "RabbitMQ UI",
  27017: "MongoDB"
};

export function normalizeTarget(target) {
  const clean = String(target || "").trim();
  if (!clean || clean.length > 253) throw new Error("Enter an IP address or hostname.");
  if (!/^[a-zA-Z0-9.:-]+$/.test(clean)) {
    throw new Error("Target can only contain letters, numbers, dots, colons, and hyphens.");
  }
  if (clean.includes("://") || clean.includes("/") || clean.startsWith("-")) {
    throw new Error("Enter only the hostname or IP, without a protocol or path.");
  }
  return clean;
}

export function parsePorts(input) {
  const raw = String(input || "").trim();
  if (!raw) return DEFAULT_PORTS;

  const ports = new Set();
  const chunks = raw.split(",").map((part) => part.trim()).filter(Boolean);

  for (const chunk of chunks) {
    if (/^\d+-\d+$/.test(chunk)) {
      const [start, end] = chunk.split("-").map(Number);
      if (start > end) throw new Error(`Invalid port range: ${chunk}`);
      if (end - start > 1000) throw new Error("A single range can include at most 1001 ports.");
      for (let port = start; port <= end; port += 1) ports.add(assertPort(port));
    } else if (/^\d+$/.test(chunk)) {
      ports.add(assertPort(Number(chunk)));
    } else {
      throw new Error(`Invalid port entry: ${chunk}`);
    }
  }

  if (ports.size === 0) throw new Error("Add at least one port.");
  if (ports.size > 2048) throw new Error("Scan at most 2048 ports per request.");
  return [...ports].sort((a, b) => a - b);
}

function assertPort(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Port ${port} is outside the 1-65535 range.`);
  }
  return port;
}

function checkPort(target, port, timeoutMs = 900) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const finish = (open, error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({
        port,
        open,
        service: SERVICE_NAMES[port] || "Unknown",
        latencyMs: open ? Date.now() - started : null,
        error: open ? null : error
      });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false, "timeout"));
    socket.once("error", (error) => finish(false, error.code || "closed"));
    socket.connect(port, target);
  });
}

export async function scanPorts(target, ports) {
  const concurrency = 80;
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < ports.length) {
      const port = ports[cursor];
      cursor += 1;
      results.push(await checkPort(target, port));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, ports.length) }, () => worker()));
  return results.sort((a, b) => a.port - b.port);
}

export function buildDiff(previousOpenPorts, currentOpenPorts) {
  const previous = new Set(previousOpenPorts);
  const current = new Set(currentOpenPorts);
  return {
    added: currentOpenPorts.filter((port) => !previous.has(port)),
    removed: previousOpenPorts.filter((port) => !current.has(port)),
    unchanged: currentOpenPorts.filter((port) => previous.has(port))
  };
}
