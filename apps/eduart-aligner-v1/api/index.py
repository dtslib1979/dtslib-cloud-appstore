from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Payload(BaseModel):
    kor_text: str
    eng_text: str

@app.post("/api/align")
def align(payload: Payload):
    # WHY: split → zip → JSON for PWA player
    k_lines = [x.strip() for x in payload.kor_text.splitlines() if x.strip()]
    e_lines = [x.strip() for x in payload.eng_text.splitlines() if x.strip()]
    n = max(len(k_lines), len(e_lines))
    data = []
    for i in range(n):
        k = k_lines[i] if i < len(k_lines) else ""
        e = e_lines[i] if i < len(e_lines) else ""
        data.append({"id": i + 1, "kor": k, "eng": e})
    return {"data": data}
