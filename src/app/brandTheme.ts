// @ts-nocheck
const MAP = { asics:"#001E62", nike:"#111111", adidas:"#000000", puma:"#D2001C", "new balance":"#CF0A2C", "under armour":"#1D1D1D", reebok:"#E01A22", apple:"#0071E3", samsung:"#1428A0", sony:"#0A0A0A", bose:"#000000", jbl:"#FF6600", anker:"#00AEEF", dyson:"#5C2D91", lg:"#A50034", xiaomi:"#FF6900", huawei:"#CF0A2C" };
export function brandColor(brand = "", domain = "") {
  const b = (brand || "").toLowerCase();
  for (const k in MAP) if (b.includes(k)) return MAP[k];
  const d = (domain || "").toLowerCase();
  for (const k in MAP) if (d.includes(k.replace(/\s/g, ""))) return MAP[k];
  return "#22d3ee"; // default
}
