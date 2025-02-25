import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { AudioFormat, VideoInfo } from "@/types";
import { toast, Toaster } from "sonner";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {PUBLIC_API_URL} from "astro:env/client"


export default function Home() {
	const [url, setUrl] = useState("");
	const [formats, setFormats] = useState<AudioFormat[] | null>();
	const [deets, setDeets] = useState<VideoInfo | null>();

	const [status, setStatus] = useState<
		"idle" | "loading" | "success" | "error"
	>("idle");
	const [errorMessage, setErrorMessage] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setStatus("loading");
		setFormats(null);
		setErrorMessage("");

		try {
			const response = await fetch(`${PUBLIC_API_URL}trigger`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ url, action: "download" }),
			});

			if (!response.ok) {
				throw new Error("Failed to fetch video information");
			}

			const data: VideoInfo = await response.json();
			setFormats(data.formats);
			setDeets(data);
			setStatus("success");
			toast.success("Check your email for the mp3 in 3-5 minutes.");
		} catch (error) {
			setStatus("error");
			const errorText =
				error instanceof Error ? error.message : "An unknown error occurred";

			setErrorMessage(errorText);
			toast.error("oops", {
				description: errorText,
			});
		}
	};
	return (
		<>
			<div className="w-full max-w-xl mx-auto p-6 flex flex-col justify-between min-h-screen">
				<div>
					<h2 className="text-4xl sm:text-5xl font-extrabold mb-4 bg-clip-text ">
						YouTube to MP3{" "}
					</h2>
					<p className="text-lg sm:text-xl mb-8 ">(for research purposes👀)</p>
				</div>

				<div className="flex-1 items-center justify-center">
					<form onSubmit={handleSubmit} className="space-y-4 w full">
						<div className="flex space-x-2">
							<Input
								type="url"
								placeholder="https://www.youtube.com/watch?v=..."
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								required
								className="placeholder:text-black rounded-none"
							/>
							<Button
								type="submit"
								disabled={status === "loading"}
								className="rounded-none"
							>
								{status === "loading" ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Processing
									</>
								) : (
									"Send mp3 to my email"
								)}
							</Button>
						</div>
					</form>

					{deets && (
						<div className="flex flex-col gap-10">
							<h2>{deets.title}</h2>
							<iframe
								src={deets.embed.iframeUrl}
								width={deets.embed.width}
								height={deets.embed.height}
								allowFullScreen
								className="w-full"
								style={{ border: "none" }}
								title={deets?.title}
							/>
						</div>
					)}
				</div>
			</div>
			<Toaster
				toastOptions={{
					style: {
						borderRadius: 0,
					},
				}}
			/>
		</>
	);
}
