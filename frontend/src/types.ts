import { type MicroformatRenderer, VideoDetails } from "@distube/ytdl-core";

export interface AudioFormat {
	audioBitrate: number;
	audioQuality: string;
	codecs: string;
	mimeType: string;
	url: string;
	contentLength: number;
	approxDurationMs: string;
}

export interface VideoInfo {
	formats: AudioFormat[];
	title: string;
	embed: MicroformatRenderer["embed"];
}
