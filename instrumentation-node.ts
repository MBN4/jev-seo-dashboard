import { importSeeds } from "./lib/server/seeds";
import { prebuildBranded } from "./lib/server/branding";
import { startMonitor } from "./lib/server/monitor";

// Add bundled seed audits that are not yet in the reports folder, then prepare their branded
// report copies in the background.
const added = await importSeeds();
for (const id of added) prebuildBranded(id);

// Scheduled audits and change checks for monitored sites (AUDITPILOT_MONITOR=0 turns this off).
startMonitor();
