import { useState } from 'react';
import SubtitlePlayer from './SubtitlePlayer';
import './index.css';

const PRESET_KOR = `오늘은 EduArt Prompter 사용법을 설명합니다.
네 줄에서 여섯 줄 정도가 가장 연습하기 좋습니다.
한 문장은 한 호흡에 말할 수 있을 정도로 짧게 만드세요.
강의 톤보다는 대화하듯이 말하는 게 좋습니다.
필요하면 녹화하면서 애드리브를 추가해도 됩니다.
이제 화면을 보면서 한 줄씩 읽어봅시다.`;

const PRESET_ENG = `Today I will explain how to use the EduArt Prompter.
Four to six lines are ideal for a first practice.
Keep each sentence short enough for one breath.
Speak more like a conversation than a formal lecture.
You can always add ad-libs while recording.
Now let's read each line one by one on screen.`;

export default function App() {
  const [kor, setKor] = useState(PRESET_KOR);
  const [eng, setEng] = useState(PRESET_ENG);
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kor_text: kor, eng_text: eng })
      });
      const j = await r.json();
      setData(j.data);
      if (j.data && j.data.length > 0) setMode('preview');
    } catch (e) {
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
          <button onClick={() => setMode('input')} style={{marginBottom:15}}>
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
        </div>
      </div>
    </div>
  );
}
