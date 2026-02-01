import express from "express";
import { exec } from "child_process";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const app = express();
const PORT = process.env.PORT || 8080;

/**
 * 1) FFmpeg 설치 확인
 */
app.get("/ffmpeg-version", (req, res) => {
  exec("ffmpeg -version", (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ ok: false, error: stderr || error.message });
    }
    res.json({ ok: true, output: stdout.split("\n")[0] });
  });
});

/**
 * 2) 렌더 테스트 (hello 텍스트)
 */
app.get("/test-render", (req, res) => {
  const text = (req.query.text || "hello").replace(/[^a-zA-Z0-9 ]/g, "");
  const outPath = "/tmp/test.mp4";

  const cmd =
    `ffmpeg -y -f lavfi -i color=c=black:s=720x1280:d=2 ` +
    `-vf drawtext=text=${text}:fontcolor=white:fontsize=60:x=(w-text_w)/2:y=(h-text_h)/2 ` +
    `-c:v libx264 -pix_fmt yuv420p -movflags +faststart ${outPath}`;

  exec(cmd, (error) => {
    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
    res.json({ ok: true, file: outPath });
  });
});

/**
 * 3) R2 연결 테스트 (버킷 목록 조회)
 */
app.get("/r2-test", async (req, res) => {
  try {
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET,
      MaxKeys: 5,
    });

    const result = await client.send(command);

    res.json({
      ok: true,
      objects: result.Contents?.map(o => o.Key) || [],
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
