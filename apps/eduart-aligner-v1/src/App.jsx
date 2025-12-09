import { useState } from 'react'

export default function App() {
  const [kor, setKor] = useState("")
  const [eng, setEng] = useState("")
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleAlign = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/align', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kor_text: kor, eng_text: eng })
      })
      const json = await res.json()
      setRows(json.data)
    } catch (e) {
      alert("Error: " + e.message)
    }
    setLoading(false)
  }

  const boxStyle = {
    maxWidth: 800,
    margin: "0 auto",
    padding: 20,
    fontFamily: "system-ui"
  }

  const txtStyle = {
    flex: 1,
    minWidth: "260px",
    height: 160,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ccc"
  }

  const btnStyle = {
    width: "100%",
    padding: 14,
    border: "none",
    borderRadius: 8,
    background: loading ? "#999" : "#0070f3",
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    cursor: loading ? "default" : "pointer"
  }

  return (
    <div style={boxStyle}>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>
        📘 EduArt Bilingual Prompter
      </h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <textarea
          placeholder="[한글] 줄 단위 스크립트..."
          style={txtStyle}
          value={kor}
          onChange={e => setKor(e.target.value)}
        />
        <textarea
          placeholder="[English] Paste aligned script here..."
          style={txtStyle}
          value={eng}
          onChange={e => setEng(e.target.value)}
        />
      </div>
      <button onClick={handleAlign} disabled={loading} style={btnStyle}>
        {loading ? "Processing..." : "✨ Generate Subtitle Data"}
      </button>

      {rows && (
        <div style={{
          marginTop: 24,
          background: "#fff",
          borderRadius: 8,
          padding: 16,
          boxShadow: "0 2px 6px rgba(0,0,0,0.06)"
        }}>
          <h3 style={{ marginTop: 0 }}>Data Preview (Ready for PWA Player)</h3>
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                display: "flex",
                gap: 12,
                padding: "8px 0",
                borderBottom: "1px solid #eee"
              }}
            >
              <div style={{ flex: 1, paddingRight: 8, color: "#333" }}>
                {row.kor}
              </div>
              <div style={{
                flex: 1,
                paddingLeft: 8,
                color: "#555",
                borderLeft: "1px solid #eee"
              }}>
                {row.eng}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
