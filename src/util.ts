import { spawn, spawnSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";


export function convertToMp3(inputBuffer: Buffer): Buffer {
  if (!ffmpeg) throw new Error("ffmpeg-static failed to load");


  const result = spawnSync(ffmpeg, [
    '-i', 'pipe:0',    // Read from stdin
    '-f', 'mp3',       // Force mp3 format
    '-vn',             // Disable video
    '-acodec', 'libmp3lame',
    '-ab', '192k',
    '-ar', '44100',
    'pipe:1'           // Output to stdout
  ], {
    input: inputBuffer,
    encoding: 'buffer',
    maxBuffer: 10 * 1024 * 1024  // 10MB buffer
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`FFmpeg process exited with code ${result.status}: ${result.stderr.toString()}`);
  }

  return result.stdout;
}
