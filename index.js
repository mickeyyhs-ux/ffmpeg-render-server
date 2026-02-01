import express from "express";
import { exec } from "child_process";

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({ ok: true, message: "server alive" });
});

app.get("/ffmpeg-version", (req, res) => {
  exec("ffmpeg -version", (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
        stderr,
      });
    }
    res.json({
      ok: true,
      output: stdout.split("\n")[0],
    });
  });
});

app.listen(port, () => {
  console.log("server running on port", port);
});
