import "server-only";
import os from "node:os";
import { engineDir, reportsDir, dataDir } from "./config";

/** Replace absolute server paths in engine output with neutral labels before it leaves the server. */
export function redactPaths(text: string): string {
  const pairs: Array<[string, string]> = [
    [reportsDir(), "<reports>"],
    [dataDir(), "<dashboard-data>"],
    [engineDir(), "<engine>"],
    [os.homedir(), "~"],
  ];
  let out = text;
  for (const [from, to] of pairs) if (from && from !== "/") out = out.split(from).join(to);
  return out;
}
