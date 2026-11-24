import { lookup, promises as dns } from "node:dns";
import type { LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";

// Keep normal OS resolution; retry failed public Atlas lookups through DNS.
// This does not change system DNS servers, hostname verification or TLS.
export const mongodbLookup: LookupFunction = (hostname, options, callback) => {
  const complete = (addresses: LookupAddress[]) => {
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  };
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (!error) return complete(addresses);
    if (
      !hostname.toLowerCase().endsWith(".mongodb.net") ||
      !["ENOTFOUND", "EAI_AGAIN"].includes(error.code ?? "")
    ) {
      callback(error, []);
      return;
    }
    const family = options.family;
    const ipv4 = family !== 6 && family !== "IPv6";
    const ipv6 = family !== 4 && family !== "IPv4";
    void Promise.allSettled([
      ipv4 ? dns.resolve4(hostname) : Promise.resolve([]),
      ipv6 ? dns.resolve6(hostname) : Promise.resolve([]),
    ]).then(([v4, v6]) => {
      const resolved = [
        ...(v4.status === "fulfilled"
          ? v4.value.map((address) => ({ address, family: 4 }))
          : []),
        ...(v6.status === "fulfilled"
          ? v6.value.map((address) => ({ address, family: 6 }))
          : []),
      ];
      if (resolved.length) complete(resolved);
      else callback(error, []);
    });
  });
};
