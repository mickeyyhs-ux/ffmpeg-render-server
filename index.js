import express from "express";
import { exec } from "child_process";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

// 0) 헬스체크 (Railway Healthcheck에 / 로 잡아도 되고 /health 로 잡아도 됨)
app.get("/", (req, res) => {
  res.send("ffmpeg render server alive");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// 1) FFmpeg 버전 확인
app.get("/ffmpeg-version", (req, res) => {
  exec("ffmpeg -version", (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        ok: false,
        error: (stderr || error.message || "").toString(),
      });
    }
    res.json({
      ok: true,
      output: stdout.split("\n")[0],
    });
  });
});

// 2) 렌더 테스트 (괄호 없는 안전 drawtext)
app.get("/test-render", (req, res) => {
  const outPath = "/tmp/test.mp4";

  // 괄호(), 특수문자 최소화, 공백/따옴표/콜론 안전하게 구성
  // 텍스트는 단순히 test 로만 (문장/한글/특수문자 넣으면 다시 깨질 수 있음)
  const cmd =
    "ffmpeg -y " +
    "-f lavfi -i color=c=black:s=720x1280:d=2 " +
    "-vf \"drawtext=text=test:fontcolor=white:fontsize=60:x=40:y=600\" " +
    "-c:v libx264 -pix_fmt yuv420p -movflags +faststart " +
    outPath;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        ok: false,
        error: (stderr || error.message || "").toString(),
        cmd,
      });
    }
    res.json({ ok: true, file: outPath });
  });
});

// 3) 생성된 파일 내려받기
app.get("/test.mp4", (req, res) => {
  const filePath = "/tmp/test.mp4";
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      ok: false,
      error: "file not found. run /test-render first",
    });
  }
  res.setHeader("Content-Type", "video/mp4");
  res.sendFile(filePath);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
