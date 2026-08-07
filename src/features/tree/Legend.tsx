import { Panel } from "@xyflow/react";
import { DASH, DESCENT, MARRIAGE } from "./palette";

function Key({
  stroke,
  width,
  dashed,
  children,
}: {
  stroke: string;
  width: number;
  dashed?: boolean;
  children: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="2" aria-hidden="true">
        <line
          x1="0"
          y1="1"
          x2="22"
          y2="1"
          stroke={stroke}
          strokeWidth={width}
          strokeDasharray={dashed ? DASH : undefined}
        />
      </svg>
      {children}
    </div>
  );
}

/** A dashed line only says something if the reader is told what. */
export function Legend() {
  return (
    <Panel
      position="top-left"
      className="!m-3 space-y-1.5 rounded-md border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-600"
    >
      <Key stroke={MARRIAGE} width={2}>
        married
      </Key>
      <Key stroke={MARRIAGE} width={2} dashed>
        together, not married
      </Key>
      <Key stroke={DESCENT} width={1.5}>
        parent to child
      </Key>
    </Panel>
  );
}
