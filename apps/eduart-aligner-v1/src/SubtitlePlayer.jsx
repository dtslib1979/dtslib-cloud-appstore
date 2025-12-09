import React, { useState } from 'react';

/**
 * v8.1 — 완전 투명 오버레이 + 하단 12% CNN 스타일 바
 */
export default function SubtitlePlayer({ data, exitPlayer }) {
  const [idx, setIdx] = useState(0);

  const isFinished = !data || idx >= data.length;
  const current = !isFinished && data && data[idx]
    ? data[idx]
    : { kor: "스크립트가 끝났습니다.", eng: "End of script." };

  const onNext = (e) => {
    if (e?.stopPropagation) e.stopPropagation();
    if (e?.preventDefault) e.preventDefault();
    if (isFinished) { exitPlayer(); return; }
    setIdx((p) => p + 1);
  };

  const onExit = (e) => {
    if (e?.stopPropagation) e.stopPropagation();
    if (e?.preventDefault) e.preventDefault();
    exitPlayer();
  };

  return (
    <div onClick={onNext} onTouchStart={onNext} style={{
      position: "fixed", inset: 0, background: "transparent",
      zIndex: 9999, userSelect: "none"
    }}>
      <button onClick={onExit} style={{
        position: "absolute", top: 14, right: 14, background: "rgba(255,0,0,0.85)",
        color: "#fff", border: "none", padding: "8px 16px", borderRadius: 999,
        fontSize: 14, fontWeight: 700, zIndex: 10000
      }}>EXIT</button>

      {/* 하단 12% 자막 바 */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: "12vh",
        background: "rgba(0,0,0,0.72)", display: "flex", flexDirection: "column",
        justifyContent: "center", padding: "6px 16px 10px 16px"
      }}>
        <div style={{
          fontSize: "1.1rem", fontWeight: 800, color: "#ffd93d", lineHeight: 1.25,
          marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
        }}>{current.kor}</div>
        <div style={{
          fontSize: "0.9rem", fontWeight: 400, color: "#ffffff", lineHeight: 1.2,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
        }}>{current.eng}</div>
        <div style={{ marginTop: 2, fontSize: "0.75rem", color: "#bbbbbb" }}>
          {isFinished
            ? "끝났습니다. 화면을 탭하면 종료합니다."
            : `${idx + 1} / ${data.length} • 다음 문장: 화면 아무 곳이나 탭`}
        </div>
      </div>
    </div>
  );
}
