/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "yt-dl-proxy",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
async run() {
  const isProd = $app.stage === 'production'
  
  const bucket = new sst.aws.Bucket("YTDLBucket", {
    access: "public"
  });

  const email = new sst.aws.Email("MyEmail", {
    sender: isProd ? "guideg6+ytdl@gmail.com" : "guideg6@gmail.com",
  });

  const queue = new sst.aws.Queue("YTDLQ", {
    visibilityTimeout: '10 minutes'
  });
  queue.subscribe({
    handler: "backend/worker.handler",
    link: [email, bucket],
    timeout: "15 minutes",
    nodejs: { install: ["ffmpeg-static"] }
  })

  const api = new sst.aws.Function("Hono", {
    url: {
      cors: {
        allowMethods: ["GET", "POST"],
        allowOrigins: ["http://localhost:3001", "http://localhost:4321"]
      }
    },
    handler: "backend/api.handler",
    timeout: "3 minutes",
    link: [queue, bucket]
  });

  new sst.aws.Astro("MyWeb", {
    path: "frontend/",
    environment: {
      PUBLIC_API_URL: api.url,
    }
  });
}
});
