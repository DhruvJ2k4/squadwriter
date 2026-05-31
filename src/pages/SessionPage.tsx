import { useParams } from "react-router-dom"
import { SessionRoom } from "@/components/session/SessionRoom"

export function SessionPage() {
  const { id } = useParams()
  if (!id) return null
  return <SessionRoom sessionId={id} />
}
