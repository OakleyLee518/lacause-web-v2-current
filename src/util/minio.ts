import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { useCallback, useMemo } from 'react'

import { BACKUP_BUCKET, MINIO_ENDPOINT } from '../constant'
import { RootState } from '@/store/store'

const zeroFill = (num: number) => String(num).padStart(2, '0')

const generateObjectKey = (user: RootState['user'], suffix = '', dateTime = new Date()) => {
  const company_id = user['custom:company']
  const user_id = user.email

  const date = [dateTime.getFullYear(), dateTime.getMonth() + 1, dateTime.getDate()].map(zeroFill)
  const time = [dateTime.getHours(), dateTime.getMinutes(), dateTime.getSeconds()].map(zeroFill)
  const baseFileName = `${date.join('-')}-${time.join('-')}` as const

  return `${company_id}/${user_id}/${date.join('/')}/${baseFileName}${suffix}` as const
}

export const uploadFile = async (file: File) => {
  const s3c = new S3Client({
    region: 'dummy',
    endpoint: MINIO_ENDPOINT,
    credentials: {
      accessKeyId: 'minio_user',
      secretAccessKey: 'minio_password',
    },
    // NOTE: This option is required for minio
    forcePathStyle: true,
    logger: console,
  })

  const up = new Upload({
    client: s3c,
    params: {
      Bucket: BACKUP_BUCKET,
      Key: file.name,
      Body: file,
      Metadata: { mimeType: file.type },
    },

    // multipart config
    queueSize: 4,
    partSize: 1024 * 1024 * 50, // require larger than 5MB
  })
  const result = await up.done()
  console.log('upload result:', result)
}

export const useUploadQueue = (user: RootState['user'], _deps: unknown[] = []) => {
  //console.log('useUploadQueue', user, _deps)
  const jobQueue = useMemo(() => new JobQueue(), [])

  return useCallback(
    (data: Blob, suffix = '', dateTime = new Date(), onFinish?: () => void) => {
      const fileName = generateObjectKey(user, suffix, dateTime)
      jobQueue.enqueue(() => uploadFile(new File([data], fileName)), onFinish)
    },
    [jobQueue, user],
  )
}

type QueueItem<T = void> = {
  job: () => Promise<T>
  onFinish?: () => void
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

class JobQueue<T = void> {
  private _queue: QueueItem<T>[]
  private _isBusy: boolean

  constructor() {
    this._queue = []
    this._isBusy = false
  }

  public enqueue(job: () => Promise<T>, onFinish?: () => void) {
    new Promise((resolve, reject) => this._queue.push({ job, onFinish, resolve, reject }))
    this.nextJob()
  }

  private nextJob() {
    console.log("called nextJob(left job count)", this._queue.length)
    if (this._isBusy || this._queue.length === 0) return
    const next = this._queue[0]

    this._isBusy = true
    next
      .job()
      .then((value: T) => {
        next.resolve(value)
        next.onFinish?.()
        this._queue.shift()
      })
      .catch((reason: unknown) => {
        console.warn('retry upload:', reason)
        next.reject(reason)
        // TODO: 失敗時になんか送る？
        // transaction.setMeasurement()
      })
      .finally(() => {
        this._isBusy = false
        setTimeout(() => this.nextJob(), 1000 * 5) // 5s
      })
  }
}
