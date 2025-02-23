import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    type PutObjectCommandInput
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Resource } from "sst";

const s3Client = new S3Client({});

interface S3UploadOptions {
    key: string;
    body: Buffer;
    contentType: string;
    metadata?: Record<string, string>;
}

interface S3FileMetadata {
    title: string;
    originalUrl: string;
    sentTo: string;
}

export const s3Service = {
    async uploadFile({ key, body, contentType, metadata }: S3UploadOptions) {
        const command = new PutObjectCommand({
            Bucket: Resource.YTDLBucket.name,
            Key: key,
            Body: body,
            ContentType: contentType,
            Metadata: metadata,
        });
        return s3Client.send(command);
    },

    async getFile(key: string) {
        const command = new GetObjectCommand({
            Bucket: Resource.YTDLBucket.name,
            Key: key,
        });
        return s3Client.send(command);
    },

    async getSignedDownloadUrl(key: string, expiresIn = 3600) {
        const command = new GetObjectCommand({
            Bucket: Resource.YTDLBucket.name,
            Key: key,
        });
        return getSignedUrl(s3Client, command, { expiresIn });
    },

    async fileExists(key: string) {
        try {
            await this.getFile(key);
            return true;
        } catch (error) {
            if (error instanceof Error && 'Code' in error && error.Code === 'NoSuchKey') {
                return false;
            }
            throw error;
        }
    },

    async getFileBuffer(key: string) {
        const file = await this.getFile(key);
        return file.Body?.transformToByteArray();
    }
};