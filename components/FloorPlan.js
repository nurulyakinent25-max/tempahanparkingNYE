import { useMemo } from "react";

/* ============================================================
   PETA TAPAK — v3
   - Kotak lot diperbesarkan supaya lot yang disewa boleh papar
     no. plat kenderaan + tempoh sewa terus di dalam kotak.
   - Baris atas (signage, lot 61, blok 60-57, blok 56-53, pondok)
     kini satu baris seragam (semua kotak saiz sama).
   - Koordinat dijana secara programatik (helper functions) untuk
     kurangkan ralat pengiraan manual.
   61 lot (tiada lot 62).
   ============================================================ */

const BOX_W = 108;
const BOX_H = 62;
const GAP = 8;
const ROW_PITCH = BOX_H + GAP;

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

/* ---------- helper: susun kolum menegak ---------- */
function columnLots(lotNumbers, x, topY) {
  return lotNumbers.map((n, i) => ({ n, x, y: topY + i * ROW_PITCH }));
}

/* ---------- helper: susun baris mendatar (lebar seragam) ---------- */
function sequenceRow(items, startX, y) {
  const positions = [];
  let x = startX;
  for (const item of items) {
    if (item.type === "gap") {
      x += item.size;
      continue;
    }
    positions.push({ ...item, x, y, w: BOX_W, h: BOX_H });
    x += BOX_W + GAP;
  }
  return { positions, endX: x };
}

const COL_X = { A: 60, B: 320, C: 320 + BOX_W + GAP, D: 700, E: 700 + BOX_W + GAP, F: 1080 };
const GRID_TOP = 236;

function buildLayout() {
  const positions = {};

  columnLots([1,2,3,4,5,6,7,8,9,10], COL_X.A, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));
  columnLots([18,17,16,15,14,13,12,11], COL_X.B, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));
  columnLots([19,20,21,22,23,24,25,26], COL_X.C, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));
  columnLots([34,33,32,31,30,29,28,27], COL_X.D, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));
  columnLots([35,36,37,38,39,40,41,42], COL_X.E, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));
  columnLots([43,44,45,46,47,48,49,50,51,52], COL_X.F, GRID_TOP).forEach((p) => (positions[p.n] = { x: p.x, y: p.y, w: BOX_W, h: BOX_H }));

  // baris atas: signage + lot 61 + blok 60-57 + blok 56-53 + pondok (satu baris, kotak seragam)
  const TOP_Y = 96;
  const { positions: topPos } = sequenceRow(
    [
      { type: "sign" },
      { type: "lot", n: 61 },
      { type: "gap", size: 26 },
      { type: "lot", n: 60 }, { type: "lot", n: 59 }, { type: "lot", n: 58 }, { type: "lot", n: 57 },
      { type: "gap", size: 26 },
      { type: "lot", n: 56 }, { type: "lot", n: 55 }, { type: "lot", n: 54 }, { type: "lot", n: 53 },
      { type: "gap", size: 26 },
      { type: "pondok" },
    ],
    COL_X.A,
    TOP_Y
  );
  const meta = { topRow: topPos, topY: TOP_Y };
  topPos.forEach((p) => {
    if (p.type === "lot") positions[p.n] = { x: p.x, y: p.y, w: p.w, h: p.h };
  });

  return { positions, meta };
}

const { positions: LAYOUT, meta: LAYOUT_META } = buildLayout();
const signMeta = LAYOUT_META.topRow.find((p) => p.type === "sign");
const pondokMeta = LAYOUT_META.topRow.find((p) => p.type === "pondok");
const lastColF = { x: COL_X.F, rows: 10 };
const VIEW_W = Math.max(pondokMeta.x + pondokMeta.w, COL_X.F + BOX_W) + 60;
const VIEW_H = GRID_TOP + 10 * ROW_PITCH + 70;

function BigArrow({ x, y, dir, size = 28, color = "#f8fafc" }) {
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

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function LotBox({ n, pos, zoneCode, status, plateNumber, endDate, onClick }) {
  const isAvailable = status === "available";
  const isPending = status === "pending";
  const isOccupied = status === "occupied";
  const fill = isAvailable ? LOT_AVAILABLE_FILL : isPending ? LOT_PENDING_FILL : LOT_OCCUPIED_FILL;
  const stroke = isAvailable ? ZONE_ACCENT[zoneCode] || "#94a3b8" : isPending ? "#fbbf24" : "#475569";
  const textColor = isAvailable ? "#f8fafc" : isPending ? "#fde68a" : "#cbd5e1";

  return (
    <g
      transform={`translate(${pos.x},${pos.y})`}
      onClick={() => isAvailable && onClick({ lot_number: n, zone_code: zoneCode, status })}
      style={{ cursor: isAvailable ? "pointer" : "default" }}
      className={isAvailable ? "transition-opacity hover:opacity-75" : ""}
    >
      <rect width={pos.w} height={pos.h} rx="6" fill={fill} stroke={stroke} strokeWidth={isAvailable ? 2.5 : 1.6} />

      {isOccupied ? (
        <>
          <text x={pos.w / 2} y="20" textAnchor="middle" fontSize="14" fontWeight="800" fontFamily="ui-monospace, monospace" fill={textColor}>{n}</text>
          <text x={pos.w / 2} y="38" textAnchor="middle" fontSize="12.5" fontWeight="700" fontFamily="ui-monospace, monospace" fill="#f8fafc" letterSpacing="0.5">{plateNumber || "-"}</text>
          <text x={pos.w / 2} y="53" textAnchor="middle" fontSize="9.5" fontWeight="500" fill="#94a3b8">hingga {formatShortDate(endDate)}</text>
        </>
      ) : (
        <text x={pos.w / 2} y={pos.h / 2 + 6} textAnchor="middle" fontSize="19" fontWeight="700" fontFamily="ui-monospace, monospace" fill={textColor}>{n}</text>
      )}
    </g>
  );
}

function SignBoard({ x, y, w, h }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width={w} height={h} rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.4" />
      <text x={w / 2} y={h / 2 - 6} textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#1e293b" letterSpacing="0.3">KELUAR</text>
      <text x={w / 2} y={h / 2 + 12} textAnchor="middle" fontSize="10" fontWeight="700" fill="#475569" letterSpacing="0.3">JLN UTAMA</text>
    </g>
  );
}

function GuardHouse({ x, y, w, h }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width={w} height={h} rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.4" />
      <text x={w / 2} y={h / 2 - 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#1e293b" letterSpacing="0.3">PONDOK</text>
      <text x={w / 2} y={h / 2 + 13} textAnchor="middle" fontSize="12" fontWeight="800" fill="#1e293b" letterSpacing="0.3">PENGAWAL</text>
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
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full min-w-[1180px] block" style={{ background: ASPHALT }}>
          {/* jalur atas: anak panah arah */}
          <rect x="0" y="0" width={VIEW_W} height="76" fill={ASPHALT_DARK} />
          <BigArrow x={VIEW_W * 0.3} y="38" dir="left" size="30" />
          <BigArrow x={VIEW_W * 0.55} y="38" dir="left" size="30" />
          <BigArrow x={VIEW_W * 0.8} y="38" dir="left" size="26" />

          {/* baris signage + lot 61 + blok atas + pondok */}
          <SignBoard x={signMeta.x} y={signMeta.y} w={signMeta.w} h={signMeta.h} />
          <GuardHouse x={pondokMeta.x} y={pondokMeta.y} w={pondokMeta.w} h={pondokMeta.h} />

          {/* lorong dua-hala menegak */}
          {[
            { x: COL_X.A + BOX_W, w: COL_X.B - (COL_X.A + BOX_W), mid: lane1Mid, label: "MASUK" },
            { x: COL_X.C + BOX_W, w: COL_X.D - (COL_X.C + BOX_W), mid: lane2Mid, label: "MASUK / KELUAR" },
            { x: COL_X.E + BOX_W, w: COL_X.F - (COL_X.E + BOX_W), mid: lane3Mid, label: "KELUAR" },
          ].map((lane, i) => (
            <g key={i}>
              <rect x={lane.x} y={GRID_TOP - 8} width={lane.w} height={10 * ROW_PITCH} fill={ASPHALT} />
              <line x1={lane.mid} y1={GRID_TOP - 8} x2={lane.mid} y2={GRID_TOP + 10 * ROW_PITCH - 20} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="8 8" opacity="0.5" />
              <BoomGate x={lane.mid} y={GRID_TOP - 34} />
              <text x={lane.mid} y={GRID_TOP - 14} textAnchor="middle" fontSize="13" fontWeight="800" fill="#e2e8f0" letterSpacing="1">{lane.label}</text>
              <BigArrow x={lane.mid - (lane.w > 100 ? 22 : 0)} y={GRID_TOP + 150} dir="up" size="24" />
              <BigArrow x={lane.mid + (lane.w > 100 ? 22 : 0)} y={GRID_TOP + 150} dir="down" size="24" />
              <BigArrow x={lane.mid - (lane.w > 100 ? 22 : 0)} y={GRID_TOP + 420} dir="up" size="24" />
              <BigArrow x={lane.mid + (lane.w > 100 ? 22 : 0)} y={GRID_TOP + 420} dir="down" size="24" />
            </g>
          ))}

          {/* label REZAB JALAN di kiri */}
          <text x="20" y={GRID_TOP + 250} fontSize="12" fontWeight="700" fill="#94a3b8" letterSpacing="2" transform={`rotate(-90 20 ${GRID_TOP + 250})`}>
            REZAB JALAN 15FT
          </text>

          {/* semua lot */}
          {Object.entries(LAYOUT).map(([n, pos]) => {
            const lotNum = Number(n);
            const data = lotByNumber[lotNum];
            if (!data) return null;
            return (
              <LotBox
                key={n}
                n={lotNum}
                pos={pos}
                zoneCode={data.zone_code}
                status={data.status}
                plateNumber={data.plate_number}
                endDate={data.end_date}
                onClick={onSelectLot}
              />
            );
          })}

          {/* jalur bawah */}
          <rect x="0" y={VIEW_H - 66} width={VIEW_W} height="66" fill={ASPHALT_DARK} />
          <BigArrow x={VIEW_W * 0.35} y={VIEW_H - 38} dir="right" size="28" />
          <BigArrow x={VIEW_W * 0.65} y={VIEW_H - 38} dir="right" size="28" />
        </svg>
      </div>
    </div>
  );
}
