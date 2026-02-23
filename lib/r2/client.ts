/**
 * Cloudflare R2 Client
 *
 * S3-compatible client configured for Cloudflare R2 storage.
 * Used server-side only (API routes) for image upload and delete operations.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID        — Cloudflare account ID
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret key
 *   R2_BUCKET_NAME       — R2 bucket name (e.g. "ramel-images")
 *   R2_PUBLIC_URL        — Public serving URL (e.g. "https://pub-xxx.r2.dev")
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const ALLOWED_PREFIXES = ['avatars/', 'gallery/', 'products/']

const getEnvOrThrow = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required env var: ${key}`)
  return value
}

let clientInstance: S3Client | null = null

export const getR2Client = (): S3Client => {
  if (clientInstance) return clientInstance

  const accountId = getEnvOrThrow('R2_ACCOUNT_ID')

  clientInstance = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: getEnvOrThrow('R2_ACCESS_KEY_ID'),
      secretAccessKey: getEnvOrThrow('R2_SECRET_ACCESS_KEY'),
    },
  })

  return clientInstance
}

export const getR2BucketName = (): string => getEnvOrThrow('R2_BUCKET_NAME')

export const getR2PublicUrl = (): string =>
  getEnvOrThrow('R2_PUBLIC_URL').replace(/\/$/, '')

export const isValidR2Key = (key: string): boolean =>
  ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix))

export const uploadToR2 = async (
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> => {
  const client = getR2Client()

  await client.send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )

  return `${getR2PublicUrl()}/${key}`
}

export const deleteFromR2 = async (key: string): Promise<void> => {
  const client = getR2Client()

  await client.send(
    new DeleteObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
    })
  )
}
