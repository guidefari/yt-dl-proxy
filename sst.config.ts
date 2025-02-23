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
  const bucket = new sst.aws.Bucket("YTDLBucket", {
    access: "public"
  });

  const email = new sst.aws.Email("MyEmail", {
    sender: "guideg6@gmail.com",
  });

  const queue = new sst.aws.Queue("YTDLQ", {
    visibilityTimeout: '10 minutes'
  });
  queue.subscribe({
    handler: "src/worker.handler",
    link: [email, bucket],
    timeout: "15 minutes",
    nodejs: { install: ["ffmpeg-static"] }
  })

  new sst.aws.Function("Hono", {
    url: {
      cors: {
        allowMethods: ["GET", "POST"],
        allowOrigins: ["http://localhost:3001"]
      }
    },
    handler: "src/index.handler",
    timeout: "3 minutes",
    link: [queue, bucket]
  });
}
});
