import os from "node:os";

/**
 * Het adres waarop je telefoon de vault kan bereiken, zolang die op hetzelfde
 * wifi-netwerk zit. localhost werkt daar namelijk niet.
 */
export function lanUrl(port = 3939): string | null {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        return `http://${address.address}:${port}`;
      }
    }
  }
  return null;
}
