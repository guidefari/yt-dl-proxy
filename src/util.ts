import { exec, spawn, spawnSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";


export function convertToMp3(inputBuffer: Buffer): Promise<Buffer> {
  
  return new Promise((resolve, reject) => {
    if (!ffmpeg) throw new Error("ffmpeg-static failed to load");
    
    const process = spawn(ffmpeg, [
      '-i', 'pipe:0',    // Read from stdin
      '-f', 'mp3',       // Force mp3 format
      '-vn',             // Disable video
      '-acodec', 'libmp3lame',
      '-ab', '192k',
      '-ar', '44100',
      'pipe:1'           // Output to stdout
    ]);

    const chunks: Uint8Array[] = [];
    let stderr = '';

    process.stdout.on('data', (chunk) => { chunks.push(chunk); });
    process.stderr.on('data', (chunk) => { stderr = stderr + chunk; });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg process exited with code ${code}: ${stderr}`));
      } else {
        resolve(Buffer.concat(chunks));
      }
    });

    process.stdin.write(inputBuffer);
    process.stdin.end();
  });
}


/**
 * Get;s the id from a youtube link
 *
 * @param {string} url - The input string to extract id from
 * @returns {string} the id
 *
 * @example
 * // returns "K-2pXMP3uu4"
 * extractId("https://youtu.be/K-2pXMP3uu4?si=TIN4XxcbS0bMea-3");
 *
 * @example
 * // returns "xuLfu0z5_m0"
 * extractId("https://www.youtube.com/shorts/xuLfu0z5_m0");
 *
 * @example
 * // returns "xuLfu0z5_m0"
 * extractId("xuLfu0z5_m0");
 *
 * @example
 * // returns null
 * extractId();
 */
export function extractId(url: string): string | null {
	if (!url) return null;

   if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }
  
	const regex =
		/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
	const match = url.match(regex);
	return match ? match[1] : null;
}
