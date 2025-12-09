import { useState, useEffect } from 'react';
import SubtitlePlayer from './SubtitlePlayer';
import { defaultKor, defaultEng } from './defaultScript';

export default function App() {
  const [kor, setKor] = useState("");
  const [eng, setEng] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('input');

  useEffect(() => {
    const saved = localStorage.getItem("eduart-script");
    if (saved) {
      const parsed = JSON.parse(saved);
      setKor(parsed.kor || defaultKor);
      setEng(parsed.eng || defaultEng);
    } else {
      setKor(defaultKor);
      setEng(defaultEng);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("eduart-script", JSON.stringify({ kor, eng }));
  }, [kor, eng]);

  const resetScript = () => { setKor(defaultKor); setEng(defaultEng); };

  const handleAlign = async () => {
    if (!kor.trim() || !eng.trim()) { alert("⚠️ 한글과 영어 텍스트를 모두 입력해주세요."); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/align', {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kor_text: kor, eng_text: eng })
      });
      const json = await res.json();
      setData(json.data);
      setMode('preview');
    } catch (e) { alert("Error: " + e.message); }
    setLoading(false);
  };

  if (mode === 'player' && data) {
    return <SubtitlePlayer data={data} exitPlayer={() => setMode('preview')} />;
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 20, fontFamily: "system-ui" }}>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>📘 EduArt Prompter v8.2</h2>

      {mode === 'preview' && (
        <button onClick={() => setMode('input')} style={{ marginBottom: 15, padding: "8px 12px", borderRadius: 6, border: "none", background: "#eee" }}>
          ⬅️ 스크립트 수정
        </button>
      )}

      {mode === 'input' && (
        <>
          <button onClick={resetScript} style={{ marginBottom: 15, padding: "8px 12px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc", background: "#fff" }}>
            ♻️ 기본 스크립트로 초기화
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>🇰🇷 Korean</label>
              <textarea value={kor} onChange={e => setKor(e.target.value)}
                style={{ width: "100%", height: 150, padding: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 15 }} />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>🇺🇸 English</label>
              <textarea value={eng} onChange={e => setEng(e.target.value)}
                style={{ width: "100%", height: 150, padding: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 15 }} />
            </div>
            <button onClick={handleAlign} disabled={loading} style={{
              width: "100%", padding: 16, borderRadius: 10, border: "none",
              fontSize: 16, fontWeight: 700, background: loading ? "#999" : "#0070f3", color: "#fff"
            }}>{loading ? "Processing..." : "✨ 자막 데이터 생성"}</button>
          </div>
        </>
      )}

      {mode === 'preview' && data && (
        <div style={{ marginTop: 10 }}>
          <div style={{ padding: 14, background: "#f7f7f7", borderRadius: 10, marginBottom: 15 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>자막 데이터 준비 완료 ({data.length}줄)</div>
            <button onClick={() => setMode('player')} style={{
              width: "100%", padding: 14, borderRadius: 8, border: "none",
              background: "#e00", color: "#fff", fontWeight: 700, fontSize: 16
            }}>▶️ 녹화 모드 시작</button>
          </div>
          <div style={{ fontSize: 13, color: "#777", marginBottom: 8 }}>👇 미리보기 (첫 3줄)</div>
          {data.slice(0, 3).map((row, idx) => (
            <div key={idx} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #eee" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{row.kor}</div>
              <div style={{ color: "#555", fontSize: 14 }}>{row.eng}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
