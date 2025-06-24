"use client"
import { useRef } from "react"

const VideoInput = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const startProcessing = () => {
    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // 每 100ms 擷取一幀（你可以之後調整）
    const interval = setInterval(() => {
      if (video.paused || video.ended) {
        clearInterval(interval)
        return
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
      console.log("抓到一幀", frame)

      // TODO：這裡你之後可以接模型推論
    }, 100)
  }

  return (
    <div className="p-4">
      <video
        ref={videoRef}
        src="/video/input.mp4"
        width={640}
        height={480}
        controls
        onPlay={startProcessing}
      />
      <canvas
        ref={canvasRef}
        width={36}
        height={36}
        style={{ display: "none" }}
      />
    </div>
  )
}

export default VideoInput
