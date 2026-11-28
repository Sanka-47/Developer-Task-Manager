export const dynamic = "force-dynamic";

/**
 * Lightweight liveness endpoint for Docker and the ALB web target group.
 * It deliberately does not call the API: a healthy web process should stay in
 * service even if the API target group is temporarily unhealthy.
 */
export function GET(): Response {
  return Response.json({
    status: "ok",
    service: "taskapp-web",
    timestamp: new Date().toISOString(),
  });
}
