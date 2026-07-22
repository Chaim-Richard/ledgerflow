sed -i '/function handleApiError(res: express.Response, err: any) {/,/^}/c\
function handleApiError(res: express.Response, err: any) {\
  console.error("[Handling API Error]", err);\
  const message = err.message || err.toString() || "";\
  const code = err.code || "";\
  console.error("[API Error Details] message:", message, "code:", code);\
\
  if (message.includes("UNAUTHENTICATED") || code === 16) {\
    return sendError(res, "Unauthenticated: " + message, 401);\
  }\
  if (message.includes("FORBIDDEN") || message.includes("PERMISSION_DENIED") || code === 7) {\
    return sendError(res, "Forbidden access: " + message, 403);\
  }\
  if (message.includes("NOT_FOUND") || code === 5) {\
    return sendError(res, "Resource not found: " + message, 404);\
  }\
  if (message.includes("INVALID_ARGUMENT") || message.includes("FAILED_PRECONDITION") || code === 3 || code === 9) {\
    return sendError(res, "Unprocessable Entity: " + message, 422);\
  }\
  if (message.includes("ALREADY_EXISTS") || code === 6) {\
    return sendError(res, "Conflict: " + message, 409);\
  }\
\
  sendError(res, message || "Internal Server Error", 500);\
}' server.ts
