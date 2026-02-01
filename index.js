import { exec } from "child_process";

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
