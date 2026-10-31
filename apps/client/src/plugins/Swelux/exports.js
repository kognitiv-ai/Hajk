// Print and download helpers for the details dialog.

/**
 * Print one element as its own page: copy it and the page's styles (MUI
 * injects them as <style> tags) into a hidden iframe and print that, so the
 * map and the rest of Hajk stay out of the printout.
 */
export function printElement(element, title) {
  const frame = document.createElement("iframe");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  // MUI (emotion) inserts its rules through the CSSOM in production, so the
  // <style> tags are empty: copy the rules themselves.
  const css = [...document.styleSheets]
    .map((sheet) => {
      try {
        return [...sheet.cssRules].map((r) => r.cssText).join("\n");
      } catch {
        return sheet.href ? `@import url("${sheet.href}");` : "";
      }
    })
    .join("\n");
  const styles = `<style>${css}</style>`;
  doc.open();
  doc.write(`<!doctype html><html lang="sv"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>${styles}
<style>
  @page { size: A4; margin: 14mm; }
  body { margin: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  [data-print-hide] { display: none !important; }
</style></head><body>${element.outerHTML}</body></html>`);
  doc.close();
  const go = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  };
  // Give embedded images (the road raster) a moment to decode.
  setTimeout(go, 300);
}

export function downloadUrl(url) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadJson(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeFileName = (s) =>
  String(s || "swelux")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

/**
 * Exchange file for DIALux evo (format "swelux-dialux-evo-exchange"): the
 * street as one typology. Version 2 carries the street and placement in the
 * swelux.ai platform's terms, the street design the engine calculated
 * (areas, pole design, rows) and the chosen luminaire with a reference to its
 * photometric file.
 */
export function buildEvoExchange({
  street,
  profile,
  detail,
  surface,
  ldtFileName,
}) {
  const { luminaire, evaluation } = detail;
  return {
    format: "swelux-dialux-evo-exchange",
    formatVersion: 2,
    note:
      "Structured Swelux→DIALux evo exchange. Import the typology as a street scene; " +
      "photometryRef points at the manufacturer's photometric file (download it alongside). " +
      "Full binary .STF export is on the roadmap.",
    project: "Hajk · swelux",
    dataset: street.name,
    typologies: [
      {
        typologyId: street.key,
        description: [street.name, street.area].filter(Boolean).join(" · "),
        standard: evaluation.standard?.id || detail.design.standardId,
        lightingClass: profile.street.lightingClass,
        street: profile.street,
        roadSurface: surface
          ? {
              id: surface.id,
              name: surface.name,
              averageLuminanceCoefficient: surface.averageLuminanceCoefficient,
            }
          : null,
        placement: profile.placement,
        design: detail.design,
        luminaire: {
          id: luminaire.id,
          name: luminaire.name,
          manufacturer: luminaire.manufacturer,
          articleNumber: luminaire.articleNumber || "",
          luminousFlux: luminaire.luminousFlux,
          systemPower: luminaire.systemPower,
          photometryRef: ldtFileName,
        },
        result: {
          status: evaluation.status,
          metrics: evaluation.areas[0]?.metrics || [],
          polesPerKilometre: detail.polesPerKilometre,
          powerPerKilometre: detail.powerPerKilometre,
        },
        quantity: street.stats.count,
      },
    ],
  };
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );
}
