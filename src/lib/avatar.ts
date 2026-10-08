import { API_URL } from "./authClient"

// Shown until a player has a profile photo of their own
const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}default-avatar.png`

// Uploaded photos are this many pixels on each side
const AVATAR_SIZE = 256

// Where to load a player's photo from. Uploaded photos are saved as a path on the API server,
// photos from a Google account as a full address
export function avatarSrc(image: string | null | undefined): string {
  if (!image) return DEFAULT_AVATAR
  return image.startsWith("/") ? `${API_URL}${image}` : image
}

// Turns a picked image file into what gets uploaded: the centre square of it, shrunk, as a JPEG
export async function toAvatarImage(file: File): Promise<Blob> {
  const picture = await createImageBitmap(file).catch(() => {
    throw new Error("Couldn't read that image")
  })
  const side = Math.min(picture.width, picture.height)

  const canvas = document.createElement("canvas")
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  const context = canvas.getContext("2d")!
  // JPEG has no transparency, so see-through parts become white rather than black
  context.fillStyle = "#fff"
  context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)
  context.drawImage(picture, (picture.width - side) / 2, (picture.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Couldn't read that image")), "image/jpeg", 0.9)
  })
}
