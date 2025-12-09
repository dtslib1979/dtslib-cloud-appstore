import { useState } from 'react';
import SubtitlePlayer from './SubtitlePlayer';

export default function App() {
  const [kor, setKor] = useState("");
  const [eng, setEng] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("input");

  const handleAlign = async () => {
    if (!kor.trim() || !eng.trim()) {
      alert("⚠️ 한글과 영어 텍스트를 모두 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/align", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kor_text: kor, eng_text: eng })
      });
      if (!res.ok) throw new Error("Request failed: " + res.status);
      const json = await res.json();
      const rows = json.data || [];
      setData(rows);
      if (rows.length === 0) {
        alert("정렬된 데이터가 없습니다.");
      } else {
        setMode("preview");
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  const copyJSON = () => {
    if (!data || !data.length) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert("✅ JSON 복사 완료");
  };

  const downloadJSON = () => {
    if (!data || !data.length) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "eduart_subtitle_data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (mode === "player" && data && data.length) {
    return <SubtitlePlayer data={data} exitPlayer={() => setMode("preview")} />;
  }

  return (
    <div style={{
      maxWidth: 640,
      margin: "0 auto",
      padding: "20px 16px 40px",
      fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    }}>
      <h2 style={{ textAlign: "center", marginBottom: 20, fontSize: "1.6rem", fontWeight: 700 }}>
        📘 EduArt Prompter v7.4
      </h2>

      {mode === "preview" && (
        <button onClick={() => setMode("input")} style={{
          marginBottom: 12, padding: "8px 12px", borderRadius: 6,
          border: "none", background: "#eee", fontSize: 14
        }}>⬅️ 스크립트 수정하기</button>
      )}

      {mode === "input" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
              🇰🇷 Korean (한글 스크립트)
            </label>
            <textarea
              placeholder="한글 스크립트를 줄 단위로 붙여넣기..."
              style={{ width: "100%", height: 150, padding: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 15, lineHeight: 1.4 }}
              value={kor} onChange={(e) => setKor(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
              🇺🇸 English (영어 스크립트)
            </label>
            <textarea
              placeholder="English script, one line per sentence..."
              style={{ width: "100%", height: 150, padding: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 15, lineHeight: 1.4 }}
              value={eng} onChange={(e) => setEng(e.target.value)}
            />
          </div>
          <button onClick={handleAlign} disabled={loading} style={{
            marginTop: 4, width: "100%", padding: 16, borderRadius: 10, border: "none",
            fontSize: 16, fontWeight: 700, background: loading ? "#999" : "#0070f3", color: "#fff"
          }}>
            {loading ? "Processing..." : "✨ 자막 데이터 정렬 (Align & Preview)"}
          </button>
        </div>
      )}

      {mode === "preview" && data && data.length > 0 && (
        <div style={{ marginTop: 10, borderRadius: 10, border: "1px solid #eee", overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: 14, background: "#f7f7f7", borderBottom: "1px solid #eee" }}>
            <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 15 }}>
              자막 데이터 준비 완료 ({data.length}줄)
            </div>
            <button onClick={() => setMode("player")} style={{
              width: "100%", padding: 14, marginBottom: 10, borderRadius: 8, border: "none",
              background: "#e00", color: "#fff", fontWeight: 700, fontSize: 16
            }}>▶️ 녹화 모드 시작 (Start Prompter)</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={copyJSON} style={{
                flex: 1, padding: 10, borderRadius: 6, border: "none", background: "#333", color: "#fff", fontSize: 13
              }}>📋 JSON 복사</button>
              <button onClick={downloadJSON} style={{
                flex: 1, padding: 10, borderRadius: 6, border: "none", background: "#333", color: "#fff", fontSize: 13
              }}>💾 파일 저장</button>
            </div>
          </div>
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 13, color: "#777", marginBottom: 8 }}>👇 미리보기 (첫 3줄)</div>
            {data.slice(0, 3).map((row, i) => (
              <div key={row.id || i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #eee" }}>
                <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>{row.kor}</div>
                <div style={{ color: "#555", fontSize: 13 }}>{row.eng}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
