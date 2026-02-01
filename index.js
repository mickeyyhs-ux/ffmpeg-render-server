import express from "express";
import { exec } from "child_process";

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("ffmpeg render server alive");
});

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
