import { useState } from 'react';

export default function SubtitlePlayer({ data, exit }) {
  const [idx, setIdx] = useState(0);
  const len = data.length;
  const done = idx >= len;
  const line = data[idx] || { kor: "", eng: "" };

  const next = () => done ? exit() : setIdx(i => i + 1);

  return (
    <div
      onClick={next}
      onTouchStart={(e) => { e.preventDefault(); next(); }}
      style={{
        position: "fixed", inset: 0, background: "transparent",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
        cursor: "pointer", userSelect: "none"
      }}
    >
      {/* 하단 자막바 */}
      <div style={{
        width: "100%", height: "12vh", minHeight: 80,
        background: "rgba(0,0,0,0.75)",
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "0 5vw", boxSizing: "border-box"
      }}>
        <div style={{ color: "#ffd93d", fontSize: "1.05rem", fontWeight: 700, marginBottom: 4 }}>
          {line.kor}
        </div>
        <div style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 300 }}>
          {line.eng}
        </div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", marginTop: 6 }}>
          {idx + 1} / {len}
        </div>
      </div>

      {/* EXIT 버튼 */}
      <button
        onClick={(e) => { e.stopPropagation(); exit(); }}
        style={{
          position: "absolute", top: 20, right: 20, zIndex: 10,
          background: "rgba(255,0,0,0.8)", color: "#fff",
          border: "none", borderRadius: 20, padding: "8px 16px",
          fontSize: 14, fontWeight: 600
        }}
      >EXIT</button>
    </div>
  );
}
