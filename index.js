import express from "express";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

// 1) 헬스체크 (Railway Healthcheck Path로 사용)
app.get("/", (req, res) => {
  res.send("ffmpeg render server alive");
});

// 2) ffmpeg 버전 확인
app.get("/ffmpeg-version", (req, res) => {
  exec("ffmpeg -version", (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        ok: false,
        error: stderr || error.message,
      });
    }
    res.json({
      ok: true,
      output: stdout.split("\n")[0],
    });
  });
});

/**
 * 3) 렌더 테스트 (외부 파일 없이)
 * 720x1280 / 2초 / 검은 배경 + test 텍스트
 */
app.get("/test-render", (req, res) => {
  const outPath = "/tmp/test.mp4";

  // 쉘에서 특수문자(따옴표, 괄호 등) 때문에 터지는 걸 방지하려고
  // drawtext의 text는 안전하게 단순 문자열로 두고,
  // 전체 커맨드는 큰따옴표로 감싸지지 않게 구성
  const cmd =
    "ffmpeg -y -f lavfi -i color=c=black:s=720x1280:d=2 " +
    "-vf drawtext=text=test:fontcolor=white:fontsize=60:x=(w-text_w)/2:y=(h-text_h)/2 " +
    "-c:v libx264 -pix_fmt yuv420p -movflags +faststart " +
    outPath;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        ok: false,
        error: (stderr || error.message || "").toString(),
      });
    }
    res.json({ ok: true, file: outPath });
  });
});

// 4) 생성된 mp4 다운로드(스트리밍)
app.get("/test.mp4", (req, res) => {
  const filePath = "/tmp/test.mp4";

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      ok: false,
      error: "file not found. run /test-render first",
    });
  }

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Disposition", "inline; filename=test.mp4");
  fs.createReadStream(filePath).pipe(res);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
