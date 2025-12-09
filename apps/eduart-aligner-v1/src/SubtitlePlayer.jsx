import React, { useState } from 'react';

export default function SubtitlePlayer({ data, exitPlayer }) {
  const [idx, setIdx] = useState(0);
  const last = data.length;
  const isFin = idx >= last;

  const next = () => {
    if (isFin) return exitPlayer();
    setIdx(i => i + 1);
  };

  const line = data[idx] || { kor:"", eng:"" };

  return (
    <div
      onClick={next}
      style={{
        position:"fixed", inset:0, display:"flex",
        flexDirection:"column", justifyContent:"flex-end",
        cursor:"pointer"
      }}
    >
      <div className="parksy-player-box">
        <div className="parksy-kor" style={{fontSize:"1.6rem", marginBottom:8}}>
          {line.kor}
        </div>
        <div className="parksy-eng" style={{fontSize:"1.2rem"}}>
          {line.eng}
        </div>

        <div style={{marginTop:16, color:"rgba(255,255,255,0.3)", fontSize:"0.9rem"}}>
          {idx+1} / {last}
        </div>
      </div>

      <button
        onClick={(e)=>{ e.stopPropagation(); exitPlayer(); }}
        style={{
          position:"absolute", top:20, right:20,
          background:"rgba(255,0,0,0.7)", color:"#fff",
          padding:"6px 12px", borderRadius:20
        }}
      >
        EXIT
      </button>
    </div>
  );
}
