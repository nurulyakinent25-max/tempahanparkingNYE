import { useMemo } from "react";

/* ============================================================
   PETA TAPAK — floor plan gaya "aerial view" gelap, dipadankan
   dengan render rujukan sebenar (papan tanda, anak panah tebal,
   Pondok Pengawal, lorong Masuk/Keluar). 61 lot (tiada lot 62 —
   ruang itu digantikan papan tanda "Pintu Keluar ke Jalan Utama").
   ============================================================ */

const BOX_W = 56;
const BOX_H = 26;
const ROW_PITCH = 30;
const TOP_H = 34;
const GRID_TOP = 168;

const COL_X = { A: 46, B: 224, C: 224 + BOX_W + 4, D: 496, E: 496 + BOX_W + 4, F: 768 };

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
  const w = (span - (lotNumbers.length - 1) * 4) / lotNumbers.length;
  return lotNumbers.map((n, i) => ({ n, x: startX + i * (w + 4), w }));
}

function buildLayout() {
  const positions = {};
  colLots([1,2,3,4,5,6,7,8,9,10], COL_X.A, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));
  colLots([18,17,16,15,14,13,12,11], COL_X.B, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));
  colLots([19,20,21,22,23,24,25,26], COL_X.C, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));
  colLots([34,33,32,31,30,29,28,27], COL_X.D, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));
  colLots([35,36,37,38,39,40,41,42], COL_X.E, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));
  colLots([43,44,45,46,47,48,49,50,51,52], COL_X.F, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));

  // lot 61 bersendirian (ruang lot 62 digantikan papan tanda "Pintu Keluar")
  positions[61] = { x: COL_X.A, y: 78, w: BOX_W, h: TOP_H };
  topLots([60, 59, 58, 57], COL_X.B, BOX_W * 2 + 4).forEach((p) => (positions[p.n] = { x: p.x, y: 78, w: p.w, h: TOP_H }));
  topLots([56, 55, 54, 53], COL_X.D, BOX_W * 2 + 4).forEach((p) => (positions[p.n] = { x: p.x, y: 78, w: p.w, h: TOP_H }));

  return positions;
}

const LAYOUT = buildLayout();
const VIEW_W = 930;
const VIEW_H = 480;

/* Anak panah tebal (gaya penanda jalan sebenar) */
function BigArrow({ x, y, dir, size = 20, color = "#f8fafc" }) {
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
      <rect width={pos.w} height={pos.h} rx="3" fill={fill} stroke={stroke} strokeWidth={isAvailable ? 2 : 1.3} />
      <text
        x={pos.w / 2}
        y={pos.h / 2 + 4}
        textAnchor="middle"
        fontSize={pos.h > 30 ? "12.5" : "11"}
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
        fill={textColor}
      >
        {n}
      </text>
      {status === "occupied" && <line x1={4} y1={pos.h - 4} x2={pos.w - 4} y2={4} stroke="#475569" strokeWidth="1.3" />}
    </g>
  );
}

function SignBoard({ x, y, w, h, lines, fontSize = 10.5 }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width={w} height={h} rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
      {lines.map((line, i) => (
        <text
          key={i}
          x={w / 2}
          y={h / 2 - ((lines.length - 1) * (fontSize + 1)) / 2 + i * (fontSize + 1) + 4}
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
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width="118" height={TOP_H} rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
      <text x="59" y={TOP_H / 2 - 2} textAnchor="middle" fontSize="10" fontWeight="800" fill="#1e293b" letterSpacing="0.3">PONDOK</text>
      <text x="59" y={TOP_H / 2 + 11} textAnchor="middle" fontSize="10" fontWeight="800" fill="#1e293b" letterSpacing="0.3">PENGAWAL</text>
    </g>
  );
}

function BoomGate({ x, y, rotate = 0 }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotate})`}>
      <rect x="-14" y="-3" width="28" height="6" rx="1.5" fill="#facc15" stroke="#1e293b" strokeWidth="0.6" />
      <rect x="-10" y="-3" width="5" height="6" fill="#1e293b" />
      <rect x="2" y="-3" width="5" height="6" fill="#1e293b" />
    </g>
  );
}

export default function FloorPlan({ lots, zones, onSelectLot }) {
  const lotByNumber = useMemo(() => {
    const m = {};
    lots.forEach((l) => (m[l.lot_number] = l));
    return m;
  }, [lots]);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 mb-4 overflow-hidden">
      <div className="flex items-center justify-between px-1 pb-2">
        <div>
          <p className="text-xs font-bold text-slate-200 tracking-wide">PETA TAPAK</p>
          <p className="text-[11px] text-slate-400">Ketik lot berwarna untuk tempah</p>
        </div>
        <div className="flex gap-3">
          {zones.map((z) => <ZoneChip key={z.code} code={z.code} label={z.tagline} />)}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg" style={{ border: "3px solid #14532d" }}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full min-w-[660px] block" style={{ maxHeight: 500, background: ASPHALT }}>
          {/* lorong sempadan atas */}
          <rect x="0" y="0" width={VIEW_W} height="60" fill={ASPHALT_DARK} />
          <BigArrow x={140} y="30" dir="left" size="26" />
          <BigArrow x={460} y="30" dir="left" size="26" />
          <BigArrow x={760} y="30" dir="left" size="22" />

          {/* papan tanda pintu keluar ke jalan utama (ganti ruang lot 62) */}
          <SignBoard x={COL_X.A} y={GRID_TOP - 96} w={BOX_W + 46} h="70" lines={["PINTU", "KELUAR KE", "JALAN UTAMA"]} fontSize="9" />

          {/* pondok pengawal */}
          <GuardHouse x={COL_X.F - 4} y={78} />

          {/* label lorong */}
          <text x={COL_X.B + BOX_W} y="70" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#e2e8f0" letterSpacing="1">MASUK</text>
          <text x={COL_X.D + BOX_W} y="70" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#e2e8f0" letterSpacing="1">MASUK / KELUAR</text>
          <text x={COL_X.F + 20} y="70" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#e2e8f0" letterSpacing="1">KELUAR</text>

          {/* boom gate di 3 pintu */}
          <BoomGate x={COL_X.A + BOX_W / 2} y="76" />
          <BoomGate x={COL_X.B + BOX_W} y="76" />
          <BoomGate x={COL_X.F + 4} y="76" />

          {/* lorong dua-hala menegak (di antara pasangan kolum) */}
          {[
            { x: COL_X.A + BOX_W, w: COL_X.B - (COL_X.A + BOX_W) },
            { x: COL_X.C + BOX_W, w: COL_X.D - (COL_X.C + BOX_W) },
            { x: COL_X.E + BOX_W, w: COL_X.F - (COL_X.E + BOX_W) },
          ].map((lane, i) => (
            <g key={i}>
              <rect x={lane.x} y={GRID_TOP - 6} width={lane.w} height="386" fill={ASPHALT} />
              <line x1={lane.x + lane.w / 2} y1={GRID_TOP - 6} x2={lane.x + lane.w / 2} y2={GRID_TOP + 380} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="7 7" opacity="0.5" />
              <BigArrow x={lane.x + lane.w / 2 - (lane.w > 60 ? 14 : 0)} y={GRID_TOP + 90} dir="up" size="20" />
              <BigArrow x={lane.x + lane.w / 2 + (lane.w > 60 ? 14 : 0)} y={GRID_TOP + 90} dir="down" size="20" />
              <BigArrow x={lane.x + lane.w / 2 - (lane.w > 60 ? 14 : 0)} y={GRID_TOP + 250} dir="up" size="20" />
              <BigArrow x={lane.x + lane.w / 2 + (lane.w > 60 ? 14 : 0)} y={GRID_TOP + 250} dir="down" size="20" />
            </g>
          ))}

          {/* label REZAB JALAN di kiri */}
          <text x="16" y={GRID_TOP + 140} fontSize="9.5" fontWeight="700" fill="#94a3b8" letterSpacing="1.5" transform={`rotate(-90 16 ${GRID_TOP + 140})`}>
            REZAB JALAN 15FT
          </text>

          {/* semua lot */}
          {Object.entries(LAYOUT).map(([n, pos]) => {
            const lotNum = Number(n);
            const data = lotByNumber[lotNum];
            if (!data) return null;
            return <LotBox key={n} n={lotNum} pos={pos} zoneCode={data.zone_code} status={data.status} onClick={onSelectLot} />;
          })}

          {/* lorong sempadan bawah */}
          <rect x="0" y="432" width={VIEW_W} height="48" fill={ASPHALT_DARK} />
          <BigArrow x={330} y="456" dir="right" size="24" />
          <BigArrow x={640} y="456" dir="right" size="24" />
          <text x={VIEW_W / 2 - 160} y="475" fontSize="9" fill="#94a3b8" textAnchor="middle" letterSpacing="0.5">PTD 47163 (BAPAK)</text>
          <text x={VIEW_W / 2 + 170} y="475" fontSize="9" fill="#94a3b8" textAnchor="middle" letterSpacing="0.5">PTD 47164 (FATTAH)</text>
        </svg>
      </div>
    </div>
  );
}
