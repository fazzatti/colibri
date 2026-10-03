import * as ERROR from "@/sep1/error.ts";

/** @internal Resolves a host and optional port without accepting URL credentials or paths. */
export function stellarTomlUrl(
  domain: string,
  allowHttp: boolean,
): { domain: string; url: string } {
  const host = domain.replace(/\/+$/, "");
  try {
    if (!host || /[\s\\/@?#%]/u.test(host)) {
      throw new ERROR.INVALID_DOMAIN(domain);
    }
    const parts = host.startsWith("[")
      ? /^(\[[0-9A-Fa-f:.]+\])(?::([0-9]{1,5}))?$/.exec(host)
      : /^([^:]+)(?::([0-9]{1,5}))?$/.exec(host);
    if (!parts) throw new ERROR.INVALID_DOMAIN(domain);
    const url = new URL(
      `${allowHttp ? "http" : "https"}://${host}/.well-known/stellar.toml`,
    );
    const hostname = url.hostname.replace(/\.$/, "");
    if (!hostname.startsWith("[")) {
      const labels = hostname.split(".");
      if (
        hostname.length > 253 ||
        (hostname !== "localhost" && labels.length < 2) ||
        labels.some((label) =>
          !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)
        )
      ) throw new ERROR.INVALID_DOMAIN(domain);
      // Reject legacy abbreviated/octal/hex IPv4 normalization while retaining IDNA.
      if (/^(?:[0-9]+\.){3}[0-9]+$/.test(hostname) && parts[1] !== hostname) {
        throw new ERROR.INVALID_DOMAIN(domain);
      }
    }
    return { domain: host, url: url.href };
  } catch (cause) {
    if (cause instanceof ERROR.INVALID_DOMAIN) throw cause;
    throw new ERROR.INVALID_DOMAIN(domain);
  }
}
