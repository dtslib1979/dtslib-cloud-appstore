import React, { useState } from 'react';

export default function SubtitlePlayer({ data, exitPlayer }) {
  const [idx, setIdx] = useState(0);
  const isFinished = idx >= data.length;
  const current = !isFinished && data && data.length ? data[idx] : { kor: "강의 완료!", eng: "" };

  const handleTap = (e) => {
    e.stopPropagation();
    if (isFinished) { exitPlayer(); return; }
    setIdx((prev) => prev + 1);
  };

  const handleExit = (e) => {
    e.stopPropagation();
    exitPlayer();
  };

  const total = data ? data.length : 0;
  const currentIndex = Math.min(idx + 1, total);

  return (
    <div onClick={handleTap} style={{
      position: "fixed", inset: 0, backgroundColor: isFinished ? "#111" : "#000",
      color: "#fff", display: "flex", flexDirection: "column", justifyContent: "flex-end",
      padding: "16px 16px 36px", cursor: "pointer", zIndex: 9999
    }}>
      <button onClick={handleExit} style={{
        position: "absolute", top: 18, right: 16, padding: "8px 12px", borderRadius: 999,
        border: "none", background: "rgba(255,0,0,0.75)", color: "#fff", fontSize: 13, fontWeight: 600
      }}>EXIT</button>

      {isFinished ? (
        <div style={{ marginBottom: "auto", marginTop: "auto", textAlign: "center" }}>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 10, color: "#4caf50" }}>강의 완료!</div>
          <div style={{ fontSize: "1rem", color: "#ccc" }}>화면을 탭하면 종료합니다.</div>
        </div>
      ) : (
        <div style={{ marginBottom: "12vh", textAlign: "center", padding: "10px 8px" }}>
          <div style={{
            fontSize: "1.8rem", fontWeight: 800, marginBottom: 10, lineHeight: 1.4,
            textShadow: "0 0 8px rgba(0,0,0,0.7)"
          }}>{current.kor}</div>
          {current.eng && (
            <div style={{ fontSize: "1.1rem", fontWeight: 400, color: "#d0d0d0", lineHeight: 1.3 }}>
              {current.eng}
            </div>
          )}
          <div style={{ marginTop: 18, fontSize: "0.8rem", color: "#888" }}>
            {currentIndex} / {total} · TAP → 다음 문장
          </div>
        </div>
      )}
    </div>
  );
}
