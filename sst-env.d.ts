/* This file is auto-generated by SST. Do not edit. */
/* tslint:disable */
/* eslint-disable */
/* deno-fmt-ignore-file */

declare module "sst" {
  export interface Resource {
    "Hono": {
      "name": string
      "type": "sst.aws.Function"
      "url": string
    }
    "MyEmail": {
      "configSet": string
      "sender": string
      "type": "sst.aws.Email"
    }
    "YTDLBucket": {
      "name": string
      "type": "sst.aws.Bucket"
    }
    "YTDLQ": {
      "type": "sst.aws.Queue"
      "url": string
    }
  }
}
/// <reference path="sst-env.d.ts" />

import "sst"
export {}