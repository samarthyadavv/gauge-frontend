import { writeFile } from "node:fs/promises";

const configuredOrigin = process.env.GAUGE_API_ORIGIN?.trim();
if (configuredOrigin) {
  const backend = URL.parse(configuredOrigin);
  if (
    !backend ||
    backend.protocol !== "https:" ||
    ![backend.origin, `${backend.origin}/`].includes(configuredOrigin)
  ) {
    throw new Error(
      "GAUGE_API_ORIGIN must be an HTTPS origin without credentials, a path, or a query.",
    );
  }
  await writeFile(
    new URL("../dist/_redirects", import.meta.url),
    `/api/* ${backend.origin}/api/:splat 200!\n`,
  );
}
