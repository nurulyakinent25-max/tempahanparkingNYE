import { useMemo } from "react";

/* ============================================================
   PETA TAPAK — v2
   Perbaikan: (1) saiz diperbesarkan untuk ketepatan sentuhan di
   telefon, (2) papan tanda "Pintu Keluar" dipindah ke jalur atas
   supaya tidak bertindih dengan lot 61, (3) label MASUK/KELUAR
   dipindah ke mulut lorong (atas grid utama).
   61 lot (tiada lot 62).
   ============================================================ */

const BOX_W = 76;
const BOX_H = 34;
const ROW_PITCH = 42;
const TOP_H = 44;
const GRID_TOP = 210;

const COL_X = { A: 56, B: 300, C: 300 + BOX_W + 6, D: 660, E: 660 + BOX_W + 6, F: 1020 };

const ZONE_ACCENT = {
  A: "#60a5fa", // biru - Pakej Semester
  B: "#2dd4bf", // teal - Pakej 3 Bulan
  C: "#fbbf24", // ambar - Bulanan & Harian
};

const ASPHALT = "#334155";
const ASPHALT_DARK = "#1e293b";
const LOT_AVAILABLE_FILL = "#475569";
const LOT_OCCUPIED_FILL = "#233042";
const LOT_PENDING_FILL = "#57430f";

function colLots(lotNumbers, x, topY) {
  return lotNumbers.map((n, i) => ({ n, x, y: topY + i * ROW_PITCH }));
}
function topLots(lotNumbers, startX, span) {
  const w = (span - (lotNumbers.length - 1) * 6) / lotNumbers.length;
  return lotNumbers.map((n, i) => ({ n, x: startX + i * (w + 6), w }));
}

function buildLayout() {
  const positions = {};
  colLots([1,2,3,4,5,6,7,8,9,10], COL_X.A, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));
  colLots([18,17,16,15,14,13,12,11], COL_X.B, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));
  colLots([19,20,21,22,23,24,25,26], COL_X.C, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));
  colLots([34,33,32,31,30,29,28,27], COL_X.D, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));
  colLots([35,36,37,38,39,40,41,42], COL_X.E, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));
  colLots([43,44,45,46,47,48,49,50,51,52], COL_X.F, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));

  // lot 61 bersendirian - baris atas, TIADA lagi bertindih dgn signboard
  positions[61] = { x: COL_X.A, y: 86, w: BOX_W, h: TOP_H };
  topLots([60, 59, 58, 57], COL_X.B, BOX_W * 2 + 6).forEach((p) => (positions[p.n] = { x: p.x, y: 86, w: p.w, h: TOP_H }));
  topLots([56, 55, 54, 53], COL_X.D, BOX_W * 2 + 6).forEach((p) => (positions[p.n] = { x: p.x, y: 86, w: p.w, h: TOP_H }));

  return positions;
}

const LAYOUT = buildLayout();
const VIEW_W = 1180;
const VIEW_H = 700;

function BigArrow({ x, y, dir, size = 26, color = "#f8fafc" }) {
  const r = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <g transform={`translate(${x},${y}) rotate(${r})`}>
      <rect x={-size * 0.11} y={-size * 0.1} width={size * 0.22} height={size * 0.75} fill={color} />
      <path d={`M ${-size * 0.4} ${size * 0.4} L 0 ${-size * 0.6} L ${size * 0.4} ${size * 0.4} Z`} fill={color} />
    </g>
  );
}

function ZoneChip({ code, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ZONE_ACCENT[code] }} />
      <span className="text-[10px] text-slate-300 font-medium">{label}</span>
    </span>
  );
}

function LotBox({ n, pos, zoneCode, status, onClick }) {
  const isAvailable = status === "available";
  const isPending = status === "pending";
  const fill = isAvailable ? LOT_AVAILABLE_FILL : isPending ? LOT_PENDING_FILL : LOT_OCCUPIED_FILL;
  const stroke = isAvailable ? ZONE_ACCENT[zoneCode] || "#94a3b8" : isPending ? "#fbbf24" : "#475569";
  const textColor = isAvailable ? "#f8fafc" : isPending ? "#fde68a" : "#64748b";

  return (
    <g
      transform={`translate(${pos.x},${pos.y})`}
      onClick={() => isAvailable && onClick({ lot_number: n, zone_code: zoneCode, status })}
      style={{ cursor: isAvailable ? "pointer" : "default" }}
      className={isAvailable ? "transition-opacity hover:opacity-75" : ""}
    >
      <rect width={pos.w} height={pos.h} rx="4" fill={fill} stroke={stroke} strokeWidth={isAvailable ? 2.5 : 1.6} />
      <text
        x={pos.w / 2}
        y={pos.h / 2 + 5}
        textAnchor="middle"
        fontSize={pos.h > 38 ? "16" : "14.5"}
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
        fill={textColor}
      >
        {n}
      </text>
      {status === "occupied" && <line x1={5} y1={pos.h - 5} x2={pos.w - 5} y2={5} stroke="#475569" strokeWidth="1.6" />}
    </g>
  );
}

function SignBoard({ x, y, w, h, lines, fontSize = 12 }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width={w} height={h} rx="5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
      {lines.map((line, i) => (
        <text
          key={i}
          x={w / 2}
          y={h / 2 - ((lines.length - 1) * (fontSize + 2)) / 2 + i * (fontSize + 2) + 5}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="800"
          fill="#1e293b"
          letterSpacing="0.3"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function GuardHouse({ x, y }) {
  const w = 170;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width={w} height={TOP_H} rx="5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
      <text x={w / 2} y={TOP_H / 2 - 2} textAnchor="middle" fontSize="13" fontWeight="800" fill="#1e293b" letterSpacing="0.3">PONDOK</text>
      <text x={w / 2} y={TOP_H / 2 + 15} textAnchor="middle" fontSize="13" fontWeight="800" fill="#1e293b" letterSpacing="0.3">PENGAWAL</text>
    </g>
  );
}

function BoomGate({ x, y, rotate = 0 }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotate})`}>
      <rect x="-18" y="-4" width="36" height="8" rx="2" fill="#facc15" stroke="#1e293b" strokeWidth="0.8" />
      <rect x="-13" y="-4" width="6" height="8" fill="#1e293b" />
      <rect x="3" y="-4" width="6" height="8" fill="#1e293b" />
    </g>
  );
}

function LaneMouthLabel({ x, text }) {
  return (
    <text x={x} y={GRID_TOP - 14} textAnchor="middle" fontSize="13" fontWeight="800" fill="#e2e8f0" letterSpacing="1">
      {text}
    </text>
  );
}

export default function FloorPlan({ lots, zones, onSelectLot }) {
  const lotByNumber = useMemo(() => {
    const m = {};
    lots.forEach((l) => (m[l.lot_number] = l));
    return m;
  }, [lots]);

  const lane1Mid = (COL_X.A + BOX_W + COL_X.B) / 2;
  const lane2Mid = (COL_X.C + BOX_W + COL_X.D) / 2;
  const lane3Mid = (COL_X.E + BOX_W + COL_X.F) / 2;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 mb-4 overflow-hidden">
      <div className="flex items-center justify-between px-1 pb-2">
        <div>
          <p className="text-xs font-bold text-slate-200 tracking-wide">PETA TAPAK</p>
          <p className="text-[11px] text-slate-400">Ketik lot berwarna untuk tempah &middot; Leret ke kiri atau kanan untuk lihat keseluruhan</p>
        </div>
        <div className="flex gap-3">
          {zones.map((z) => <ZoneChip key={z.code} code={z.code} label={z.tagline} />)}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg" style={{ border: "4px solid #14532d" }}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full min-w-[980px] block" style={{ background: ASPHALT }}>
          {/* jalur atas: papan tanda pintu keluar (sekecil kotak lot) + anak panah arah */}
          <rect x="0" y="0" width={VIEW_W} height="76" fill={ASPHALT_DARK} />
          <SignBoard x={COL_X.A} y="16" w={BOX_W} h={TOP_H} lines={["KELUAR", "JLN UTAMA"]} fontSize="8.5" />
          <BigArrow x={300} y="38" dir="left" size="30" />
          <BigArrow x={650} y="38" dir="left" size="30" />
          <BigArrow x={980} y="38" dir="left" size="26" />

          {/* pondok pengawal (baris atas, kanan sekali) */}
          <GuardHouse x={COL_X.F - 20} y={86} />

          {/* lorong dua-hala menegak */}
          {[
            { x: COL_X.A + BOX_W, w: COL_X.B - (COL_X.A + BOX_W), mid: lane1Mid, label: "MASUK" },
            { x: COL_X.C + BOX_W, w: COL_X.D - (COL_X.C + BOX_W), mid: lane2Mid, label: "MASUK / KELUAR" },
            { x: COL_X.E + BOX_W, w: COL_X.F - (COL_X.E + BOX_W), mid: lane3Mid, label: "KELUAR" },
          ].map((lane, i) => (
            <g key={i}>
              <rect x={lane.x} y={GRID_TOP - 8} width={lane.w} height="588" fill={ASPHALT} />
              <line x1={lane.mid} y1={GRID_TOP - 8} x2={lane.mid} y2={GRID_TOP + 580} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="8 8" opacity="0.5" />
              <BoomGate x={lane.mid} y={GRID_TOP - 34} />
              <LaneMouthLabel x={lane.mid} text={lane.label} />
              <BigArrow x={lane.mid - (lane.w > 90 ? 20 : 0)} y={GRID_TOP + 130} dir="up" size="24" />
              <BigArrow x={lane.mid + (lane.w > 90 ? 20 : 0)} y={GRID_TOP + 130} dir="down" size="24" />
              <BigArrow x={lane.mid - (lane.w > 90 ? 20 : 0)} y={GRID_TOP + 370} dir="up" size="24" />
              <BigArrow x={lane.mid + (lane.w > 90 ? 20 : 0)} y={GRID_TOP + 370} dir="down" size="24" />
            </g>
          ))}

          {/* label REZAB JALAN di kiri */}
          <text x="20" y={GRID_TOP + 210} fontSize="12" fontWeight="700" fill="#94a3b8" letterSpacing="2" transform={`rotate(-90 20 ${GRID_TOP + 210})`}>
            REZAB JALAN 15FT
          </text>

          {/* semua lot */}
          {Object.entries(LAYOUT).map(([n, pos]) => {
            const lotNum = Number(n);
            const data = lotByNumber[lotNum];
            if (!data) return null;
            return <LotBox key={n} n={lotNum} pos={pos} zoneCode={data.zone_code} status={data.status} onClick={onSelectLot} />;
          })}

          {/* jalur bawah */}
          <rect x="0" y={VIEW_H - 66} width={VIEW_W} height="66" fill={ASPHALT_DARK} />
          <BigArrow x={420} y={VIEW_H - 38} dir="right" size="28" />
          <BigArrow x={820} y={VIEW_H - 38} dir="right" size="28" />
        </svg>
      </div>
    </div>
  );
}
