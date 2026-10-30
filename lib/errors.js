export class AppError extends Error {
  constructor(message, status = 400, code = 'BAD_REQUEST') {
    super(message)
    this.status = status
    this.code = code
  }
}
export function errorResponse(error) {
  if (error instanceof AppError)
    return Response.json(
      { success: false, error: error.code, message: error.message },
      {
        status: error.status,
        headers:
          error.headers ||
          (error.status === 503 ? { 'Retry-After': '10' } : {}),
      }
    )
  return Response.json(
    {
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Service temporarily unavailable',
    },
    { status: 503, headers: { 'Retry-After': '10' } }
  )
}
