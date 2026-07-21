/**
 * Utility functions for parsing model sizes, converting MB/GB, and calculating total storage requirement.
 */

export function parseSizeToMB(sizeStr) {
  if (!sizeStr || sizeStr === "Unknown") return 0;
  
  // BUG-8 fix: strip leading non-numeric chars (e.g. "~4.5 GB" → "4.5 GB")
  const cleanStr = String(sizeStr).trim().replace(/^[^\d.]+/, '').toUpperCase();
  const match = cleanStr.match(/^([\d.]+)\s*(GB|MB|KB|B)?$/);
  
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2] || "MB";
  
  switch (unit) {
    case "GB":
      return value * 1024;
    case "MB":
      return value;
    case "KB":
      return value / 1024;
    case "B":
      return value / (1024 * 1024);
    default:
      return value;
  }
}

export function formatMB(mbValue) {
  if (mbValue <= 0) return "0 MB";
  if (mbValue >= 1024) {
    const gb = mbValue / 1024;
    return `${gb.toFixed(2)} GB`;
  }
  return `${mbValue.toFixed(2)} MB`;
}

export function calculateStorageBreakdown(modelsList) {
  const breakdown = {
    checkpoints: 0,
    diffusion_models: 0,
    clip: 0,
    vae: 0,
    loras: 0,
    controlnet: 0,
    ipadapter: 0,
    llm_gguf: 0,
    sams: 0,
    other: 0
  };

  let totalMB = 0;
  let unknownCount = 0;

  modelsList.forEach(model => {
    const mb = parseSizeToMB(model.size);
    if (mb === 0 && model.size === "Unknown") {
      unknownCount++;
    }
    
    totalMB += mb;

    const folderKey = (model.folder || "other").toLowerCase().replace(/[^a-z_]/g, "");
    
    if (folderKey.includes("checkpoint")) {
      breakdown.checkpoints += mb;
    } else if (folderKey.includes("diffusion") || folderKey.includes("unet")) {
      breakdown.diffusion_models += mb;
    } else if (folderKey.includes("clip") || folderKey.includes("text_encoder")) {
      breakdown.clip += mb;
    } else if (folderKey.includes("vae")) {
      breakdown.vae += mb;
    } else if (folderKey.includes("lora")) {
      breakdown.loras += mb;
    } else if (folderKey.includes("controlnet")) {
      breakdown.controlnet += mb;
    } else if (folderKey.includes("ipadapter") || folderKey.includes("ip_adapter")) {
      breakdown.ipadapter += mb;
    } else if (folderKey.includes("llm") || folderKey.includes("gguf")) {
      breakdown.llm_gguf += mb;
    } else if (folderKey.includes("sam") || folderKey.includes("pth")) {
      breakdown.sams += mb;
    } else {
      breakdown.other += mb;
    }
  });

  return {
    totalMB,
    totalFormatted: formatMB(totalMB),
    unknownCount,
    breakdown
  };
}

export function getCategoryBadgeColor(folderName) {
  const f = (folderName || "").toLowerCase();
  if (f.includes("checkpoint")) return { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" };
  if (f.includes("diffusion") || f.includes("unet")) return { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" };
  if (f.includes("clip") || f.includes("text_encoder")) return { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" };
  if (f.includes("vae")) return { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" };
  if (f.includes("lora")) return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" };
  if (f.includes("controlnet")) return { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" };
  if (f.includes("ipadapter")) return { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" };
  if (f.includes("llm") || f.includes("gguf")) return { bg: "bg-fuchsia-500/10", text: "text-fuchsia-400", border: "border-fuchsia-500/20" };
  return { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" };
}
