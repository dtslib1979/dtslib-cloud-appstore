import React, { useState } from 'react';

/**
 * v8.0 — 12% Bottom Subtitle Bar
 * - 전체 화면은 투명한 터치 레이어
 * - 하단 12vh만 반투명 블랙 바 + 2줄 자막(한/영)
 * - 화면 아무 곳이나 탭 → 다음 문장
 * - EXIT 버튼 유지
 */
export default function SubtitlePlayer({ data, exitPlayer }) {
  const [idx, setIdx] = useState(0);

  const isFinished = !data || idx >= data.length;
  const current = !isFinished && data && data[idx]
    ? data[idx]
    : { kor: "스크립트가 끝났습니다.", eng: "End of script." };

  const handleTap = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (e && e.preventDefault) e.preventDefault();
    if (isFinished) { exitPlayer(); return; }
    setIdx((prev) => prev + 1);
  };

  const handleExit = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (e && e.preventDefault) e.preventDefault();
    exitPlayer();
  };

  return (
    <div onClick={handleTap} onTouchStart={handleTap} style={{
      position: "fixed", inset: 0, background: "transparent",
      zIndex: 9999, userSelect: "none"
    }}>
      <button onClick={handleExit} style={{
        position: "absolute", top: 16, right: 16, background: "rgba(255,0,0,0.85)",
        color: "#fff", border: "none", padding: "8px 16px", borderRadius: 999,
        fontSize: 14, fontWeight: 700
      }}>EXIT</button>

      {/* 하단 12% 자막 바 */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        height: "12vh", background: "rgba(0,0,0,0.75)", color: "#fff",
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "6px 14px 8px 14px"
      }}>
        <div style={{
          fontSize: "1.05rem", fontWeight: 800, lineHeight: 1.3, marginBottom: 2,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
        }}>{current.kor}</div>
        <div style={{
          fontSize: "0.9rem", fontWeight: 400, lineHeight: 1.25, color: "#dddddd",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
        }}>{current.eng}</div>
        <div style={{ marginTop: 2, fontSize: "0.7rem", color: "#aaaaaa" }}>
          {isFinished
            ? "끝 • 화면을 터치하면 종료됩니다."
            : `${idx + 1} / ${data.length} • 화면 아무 곳이나 터치해서 다음 문장으로`}
        </div>
      </div>
    </div>
  );
}
