import { useState } from 'react';
import SubtitlePlayer from './SubtitlePlayer';
import './index.css';

export default function App() {
  const [kor, setKor] = useState("");
  const [eng, setEng] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('input');

  const handleAlign = async () => {
    if (!kor.trim() || !eng.trim()) {
      alert("⚠️ 한글과 영어 텍스트를 모두 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/align', {
        method:"POST",
        headers:{ "Content-Type": "application/json" },
        body: JSON.stringify({ kor_text: kor, eng_text: eng })
      });
      const j = await r.json();
      setData(j.data);
      if (j.data && j.data.length > 0) setMode('preview');
    } catch(e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  if (mode === 'player' && data) {
    return (
      <div className="parksy-root">
        <div className="parksy-main">
          <SubtitlePlayer data={data} exitPlayer={() => setMode('preview')} />
        </div>
      </div>
    );
  }

  return (
    <div className="parksy-root">
      <div className="parksy-main">
      
        {mode === 'preview' && (
          <button
            onClick={() => setMode('input')}
            style={{marginBottom:15, padding:"8px 12px"}}
          >
            ⬅️ 수정하기
          </button>
        )}

        <div className="parksy-panel">
          {mode === 'input' && (
            <>
              <label className="parksy-kor">🇰🇷 Korean</label>
              <textarea
                value={kor}
                onChange={e => setKor(e.target.value)}
                style={{ width:"100%", height:150, marginBottom:20 }}
              />

              <label className="parksy-eng">🇺🇸 English</label>
              <textarea
                value={eng}
                onChange={e => setEng(e.target.value)}
                style={{ width:"100%", height:150, marginBottom:20 }}
              />

              <button
                onClick={handleAlign}
                disabled={loading}
                style={{ width:"100%", padding:12, fontWeight:"bold" }}
              >
                {loading ? "Processing..." : "✨ Align"}
              </button>
            </>
          )}

          {mode === 'preview' && data && (
            <>
              <button
                onClick={() => setMode('player')}
                style={{
                  width:"100%", marginBottom:15,
                  background:"#E11", color:"#fff", padding:12
                }}>
                ▶️ 재생
              </button>

              <div style={{color:"#fff"}}>첫 3줄 미리보기:</div>
              {data.slice(0,3).map((row, idx)=>(
                <div key={idx} style={{marginTop:10}}>
                  <div className="parksy-kor">{row.kor}</div>
                  <div className="parksy-eng">{row.eng}</div>
                </div>
              ))}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
