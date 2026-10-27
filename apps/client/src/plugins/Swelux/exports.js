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
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')]
    .map((n) => n.outerHTML)
    .join("\n");
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
 * Same exchange format swelux.ai's replacement export writes for DIALux evo
 * (format "swelux-dialux-evo-exchange", v1): the street as one typology with
 * geometry and a reference to the luminaire's LDT.
 */
export function buildEvoExchange({
  street,
  profile,
  detail,
  ldtFileName,
  flux,
}) {
  return {
    format: "swelux-dialux-evo-exchange",
    formatVersion: 1,
    note:
      "Structured Swelux→DIALux evo exchange. Import the typology as a street scene; " +
      "photometryRef points at the manufacturer LDT (download it alongside). " +
      "Full binary .STF export is on the roadmap.",
    project: "Hajk · swelux",
    dataset: street.name,
    typologies: [
      {
        typologyId: street.key,
        description: `${street.name} (${street.area})`,
        lightingClass: profile.requiredClass,
        geometry: {
          roadWidthM: profile.roadWidthM,
          lanes: profile.lanes,
          poleHeightM: profile.poleHeightM,
          armLengthM: profile.armLengthM,
          tiltDeg: profile.tiltDeg,
          spacingM: profile.spacingM,
          arrangement: profile.arrangement,
          surfaceClass: profile.surfaceClass,
        },
        luminaire: {
          name: detail.luminaire.name,
          vendor: detail.luminaire.manufacturer,
          articleNumber: detail.luminaire.articleNumber || "",
          photometryRef: ldtFileName,
          lumens: flux || 0,
          wattage: detail.luminaire.powerW,
          cct: 0,
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
