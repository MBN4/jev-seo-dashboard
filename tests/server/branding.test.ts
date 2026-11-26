import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.join(__dirname, "..", "..", "scripts", "brand_report.py");
const py = (args: string[]) => execFileSync("python3", [SCRIPT, ...args], { encoding: "utf8" });

describe("branded report copies (scripts/brand_report.py)", () => {
  it("rebrands Markdown, digest and Excel text, ids and colours without touching the originals", () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), "brand-src-"));
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "brand-out-"));
    fs.writeFileSync(path.join(src, "audit.json"), "{}");
    const md = "# Jev SEO audit: example.org\nJEV-001 judged by Jev; Jev's view. Built with jev-seo (https://github.com/AgriciDaniel/jev-seo). Colour #d45bb6, ink #0b0b0b.\n![h](charts/jev_heatmap.png)\n";
    fs.writeFileSync(path.join(src, "report.md"), md);
    fs.writeFileSync(path.join(src, "digest.md"), "Jev judgments unavailable. JEV-002.");
    execFileSync("python3", ["-c", `
import zipfile,sys
z=zipfile.ZipFile(sys.argv[1],'w')
z.writestr('xl/sharedStrings.xml','<sst><si><t>Jev SEO audit: x</t></si><si><t>Type (Jev)</t></si><si><t>JEV-003</t></si></sst>')
z.writestr('xl/styles.xml','<styleSheet><fill><fgColor rgb="00D45BB6"/></fill><fgColor rgb="000B0B0B"/></styleSheet>')
z.close()`, path.join(src, "report.xlsx")]);
    const log = py(["--src", src, "--out", out, "--name", "AuditPilot", "--prefix", "AP", "--formats", "md,digest,xlsx"]);
    expect(log).toMatch(/md: written/);
    const outMd = fs.readFileSync(path.join(out, "report.md"), "utf8");
    expect(outMd).not.toMatch(/jev/i);
    expect(outMd).toContain("# AuditPilot SEO audit: example.org");
    expect(outMd).toContain("AP-001 judged by AI; the AI's view.");
    expect(fs.readFileSync(path.join(out, "digest.md"), "utf8")).toBe("AI judgments unavailable. AP-002.");
    const xml = execFileSync("python3", ["-c", "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.read('xl/sharedStrings.xml').decode());print(z.read('xl/styles.xml').decode())", path.join(out, "report.xlsx")], { encoding: "utf8" });
    expect(xml).not.toMatch(/jev/i);
    expect(xml).toContain("AuditPilot SEO audit: x");
    expect(xml).toContain("AP-003");
    expect(xml).not.toContain("D45BB6"); // magenta turned green
    expect(xml).toContain("0B0B0B"); // neutral colours untouched
    // originals unchanged
    expect(fs.readFileSync(path.join(src, "report.md"), "utf8")).toBe(md);
  });

  it("leaves local font paths intact so the PDF still renders", () => {
    const out = execFileSync("python3", ["-c", `
import importlib.util,sys
spec=importlib.util.spec_from_file_location('b', sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
print(m.rebrand_text("src: url('file:///opt/jev-seo/jevseo/fonts/Inter.otf'); .tile.jev{color:var(--jev)} Jev", "AuditPilot", "AP"))
print(m.recolor_hex('d45bb6'), m.recolor_hex('0b0b0b'), m.recolor_hex('1d4f8a'))`, SCRIPT], { encoding: "utf8" });
    expect(out).toContain("file:///opt/jev-seo/jevseo/fonts/Inter.otf");
    expect(out).toContain(".tile.brand{color:var(--brand)} AI");
    const [magenta, black, blue] = out.trim().split("\n").at(-1)!.split(" ");
    expect(magenta).not.toBe("d45bb6");
    expect(black).toBe("0b0b0b");
    expect(blue).toBe("1d4f8a");
  });
});
