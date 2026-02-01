import express from "express";
import { exec } from "child_process";

const app = express();
const PORT = process.env.PORT || 8080;

/**
 * 헬스체크 / 기본 확인
 */
app.get("/", (req, res) => {
  res.send("ffmpeg render server alive");
});

/**
 * ffmpeg 설치 여부 확인
 */
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
 * 렌더 테스트 (외부 파일 없이)
 * 720x1280 / 2초 / 검은 배경 + test 텍스트
 */
app.get("/test-render", (req, res) => {
  exec(
    "ffmpeg -y -f lavfi -i color=c=black:s=720x1280:d=2 -vf drawtext=text='test':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=(h-text_h)/2 /tmp/test.mp4",
    (error) => {
      if (error) {
        return res.status(500).json({
          ok: false,
          error: error.message,
        });
      }

      res.json({
        ok: true,
        file: "/tmp/test.mp4",
      });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
