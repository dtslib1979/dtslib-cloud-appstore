import React, { useState } from 'react';

export default function SubtitlePlayer({ data, exitPlayer }) {
  const [idx, setIdx] = useState(0);

  const length = Array.isArray(data) ? data.length : 0;
  const isFinished = idx >= length;
  const current = !isFinished && length > 0 ? data[idx] : { kor: "스크립트가 끝났습니다.", eng: "" };

  const advance = () => {
    if (!length) return;
    if (idx + 1 >= length) {
      setIdx(length);
      return;
    }
    setIdx((prev) => prev + 1);
  };

  const handleTap = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (isFinished) { exitPlayer(); } else { advance(); }
  };

  const handleExit = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    exitPlayer();
  };

  return (
    <div onClick={handleTap} onTouchStart={handleTap} style={{
      position: 'fixed', inset: 0, background: isFinished ? '#222' : '#000',
      color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      padding: '20px 20px 40px 20px', textAlign: 'center', cursor: 'pointer',
      zIndex: 9999, userSelect: 'none'
    }}>
      <button onClick={handleExit} style={{
        position: 'absolute', top: 20, right: 20, background: 'rgba(255,0,0,0.8)',
        color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 20, fontSize: 14
      }}>EXIT</button>

      {isFinished ? (
        <div style={{ marginBottom: 'auto', marginTop: 'auto' }}>
          <h1 style={{ color: '#4caf50', marginBottom: 8 }}>강의 완료!</h1>
          <p style={{ fontSize: '1rem', color: '#ccc' }}>화면을 한 번 더 터치하면 종료합니다.</p>
        </div>
      ) : (
        <div style={{ marginBottom: '10vh' }}>
          <div style={{
            fontSize: '1.8rem', fontWeight: 800, marginBottom: '14px',
            lineHeight: 1.4, color: '#fff'
          }}>{current.kor}</div>
          <div style={{
            fontSize: '1.2rem', color: '#ccc', fontWeight: 400, lineHeight: 1.3
          }}>{current.eng}</div>
          <div style={{ marginTop: 24, fontSize: '0.8rem', color: '#888' }}>
            {Math.min(idx + 1, length)} / {length} · 화면 아무 곳이나 터치해서 다음 문장으로
          </div>
        </div>
      )}
    </div>
  );
}
