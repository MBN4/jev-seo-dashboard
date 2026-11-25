import { importSeeds } from "./lib/server/seeds";
import { prebuildBranded } from "./lib/server/branding";

// Add bundled seed audits that are not yet in the reports folder, then prepare their branded
// report copies in the background.
const added = await importSeeds();
for (const id of added) prebuildBranded(id);
