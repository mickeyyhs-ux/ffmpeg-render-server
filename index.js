import express from "express";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";

const app = express();
const PORT = process.env.PORT || 8080;

// ===== 공통 =====
app.get("/", (req, res) => {
  res.send("ffmpeg render server alive");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// drawtext 안전 이스케이프 (따옴표/역슬래시/콜론 등)
function escapeDrawtextText(input) {
  const s = String(input ?? "");
  return s
    .replace(/\\/g, "\\\\")   // \  -> \\
    .replace(/:/g, "\\:")     // :  -> \:
    .replace(/'/g, "\\'")     // '  -> \'
    .replace(/\n/g, " ");     // 줄바꿈 제거
}

// ===== 1) ffmpeg 버전 확인 =====
app.get("/ffmpeg-version", (req, res) => {
  execFile("ffmpeg", ["-version"], (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        ok: false,
        error: (stderr || error.message || "").toString(),
      });
    }

    const firstLine = (stdout || "").toString().split("\n")[0];
    res.json({ ok: true, output: firstLine });
  });
});

// ===== 2) 렌더 테스트 (외부 파일 없이) =====
// 사용 예: /test-render?text=hello
app.get("/test-render", (req, res) => {
  const outPath = "/tmp/test.mp4";
  const rawText = req.query.text ?? "test";
  const safeText = escapeDrawtextText(rawText);

  // 괄호 없이 중앙정렬 (w/2 - text_w/2 형태)
  const vf = `drawtext=text='${safeText}':fontcolor=white:fontsize=60:x=w/2-text_w/2:y=h/2-text_h/2`;

  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=720x1280:d=2",
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outPath,
  ];

  execFile("ffmpeg", args, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        ok: false,
        error: (stderr || error.message || "").toString(),
      });
    }

    // 생성 성공 → 다운로드 URL까지 같이 안내
    res.json({
      ok: true,
      file: outPath,
      download: "/test.mp4",
      note: "브라우저에서 /test.mp4 로 열면 다운로드/재생됩니다.",
    });
  });
});

// ===== 3) 방금 만든 mp4 다운로드/재생 엔드포인트 =====
app.get("/test.mp4", (req, res) => {
  const filePath = "/tmp/test.mp4";

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      ok: false,
      error: "file not found. run /test-render first",
    });
  }

  // 동영상으로 인식시키기
  res.setHeader("Content-Type", "video/mp4");
  // 다운로드로 뜨게 하고 싶으면 attachment, 브라우저 재생은 inline
  res.setHeader("Content-Disposition", "inline; filename=\"test.mp4\"");

  const stream = fs.createReadStream(filePath);
  stream.on("error", (err) => {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  });
  stream.pipe(res);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
