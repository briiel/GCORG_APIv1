# Rate Limiting Implementation

## Overview
Comprehensive rate limiting has been implemented across the entire API to prevent abuse, brute force attacks, and ensure fair resource usage. The system uses a multi-layered approach with different limits for different types of operations.

## Implementation Details

### Middleware Location
`src/middleware/rateLimit.js` - Simple in-memory rate limiter

**Note**: The current implementation uses in-memory storage. For production environments with multiple server instances, consider upgrading to Redis-backed rate limiting using `express-rate-limit` with `rate-limit-redis`.

## Rate Limit Tiers

### 1. Global Rate Limit (Baseline Protection)
- **Endpoint**: All `/api/*` routes
- **Limit**: 200 requests per minute per IP
- **Purpose**: Baseline protection against abuse

### 2. Authentication Routes (`/api/auth/*`)
- **Limit**: 10 requests per 15 minutes per IP
- **Purpose**: Prevent brute force attacks on login/register
- **Endpoints**:
  - `POST /api/auth/register`
  - `POST /api/auth/login`

### 3. General API Operations
- **Limit**: 100 requests per minute per IP
- **Purpose**: Normal read operations
- **Applied to**:
  - User routes
  - Event listings
  - Attendance records
  - Organization data
  - Role requests (read)
  - Dashboard stats

### 4. Sensitive Operations
- **Limit**: 30-50 requests per minute per IP
- **Purpose**: Prevent spam and abuse of critical operations
- **Applied to**:
  - Event registration
  - Attendance marking (30/min)
  - Event status updates
  - Event deletion/restore
  - Registration approvals
  - Archive operations (50/min)
  - Admin operations (50/min)
  - Certificate operations (50/min)

### 5. Resource-Intensive Operations
- **Limit**: 20 requests per minute per IP
- **Purpose**: Prevent server overload from heavy operations
- **Applied to**:
  - Event creation (with file upload)
  - Event updates (with file upload)

### 6. Submission-Based Operations
- **Limits**:
  - Role requests: 5 submissions per 15 minutes
  - Evaluations: 10 submissions per 5 minutes
- **Purpose**: Prevent spam submissions

### 7. Metrics/Analytics
- **Limit**: 120 requests per minute per IP
- **Purpose**: Allow frequent polling while preventing abuse
- **Applied to**:
  - Site visit tracking

## Route-Specific Rate Limits

### Authentication (`authRoutes.js`)
```javascript
authLimiter: 10 requests / 15 minutes
- POST /api/auth/register
- POST /api/auth/login
```

### User Management (`userRoutes.js`)
```javascript
apiLimiter: 100 requests / minute
- GET /api/users
- GET /api/users/:id
- GET /api/users/organization/:orgId/members
- DELETE /api/users/organization/:orgId/members/:memberId
```

### Admin Operations (`adminRoutes.js`)
```javascript
adminLimiter: 50 requests / minute
- GET /api/admin/manage-users
- POST /api/admins
- DELETE /api/admins/:id
```

### Events (`eventRoutes.js`)
```javascript
uploadLimiter: 20 requests / minute
- POST /api/event/events (create with upload)
- PUT /api/event/events/:id (update with upload)

strictLimiter: 30 requests / minute
- POST /api/event/events/register
- POST /api/event/events/attendance
- PATCH /api/event/events/:id/status
- DELETE /api/event/events/:id
- POST /api/event/events/trash-multiple
- POST /api/event/events/:id/restore
- DELETE /api/event/events/:id/permanent
- POST /api/event/registrations/:id/approve
- POST /api/event/registrations/:id/reject
- POST /api/event/events/:id/request-certificate

apiLimiter: 100 requests / minute
- GET /api/event/events
- GET /api/event/participants/:student_id/events
- GET /api/event/students/:student_id/attended
- GET /api/event/events/creator/:creator_id
- GET /api/event/attendance-records
- GET /api/event/attendance-records/event/:eventId
- GET /api/event/events/trash
- GET /api/event/certificates
- GET /api/event/events/admin/:admin_id
- GET /api/event/events/organizations
- GET /api/event/events/osws
- GET /api/event/:event_id/participants
- GET /api/event/events/:id
- GET /api/event/stats/organization
- GET /api/event/stats/osws
- GET /api/event/stats/osws/charts
```

### Evaluations (`evaluationRoutes.js`)
```javascript
submitLimiter: 10 requests / 5 minutes
- POST /api/events/:event_id/evaluations

apiLimiter: 60 requests / minute
- GET /api/events/:event_id/evaluations/status
- GET /api/events/:event_id/evaluations/me
- GET /api/events/:event_id/evaluations
- GET /api/events/:event_id/evaluations/raw
```

### Role Requests (`roleRequestRoutes.js`)
```javascript
requestLimiter: 5 requests / 15 minutes
- POST /api/roles/request

apiLimiter: 100 requests / minute
- GET /api/organizations
- GET /api/roles/my-requests
- GET /api/admin/requests
- GET /api/admin/requests/pending
- POST /api/admin/approve/:requestId
- POST /api/admin/reject/:requestId
```

### Certificate Requests (`certificateRequestRoutes.js`)
```javascript
certLimiter: 50 requests / minute
- GET /api/certificates/requests
- POST /api/certificates/requests/:id/approve
- POST /api/certificates/requests/:id/reject
- PATCH /api/certificates/requests/:id/status
```

### Notifications (`notificationRoutes.js`)
```javascript
notificationLimiter: 60 requests / minute
- GET /api/notifications/
- PATCH /api/notifications/:id/read
- PATCH /api/notifications/read-all
```

### Archive (`archiveRoutes.js`)
```javascript
apiLimiter: 50 requests / minute
- GET /api/archive/trash
- GET /api/archive/expired-count

modifyLimiter: 30 requests / minute
- POST /api/archive/admins/:id/restore
- POST /api/archive/organizations/:id/restore
- POST /api/archive/members/:id/restore
- DELETE /api/archive/admins/:id
- DELETE /api/archive/organizations/:id
- DELETE /api/archive/members/:id
- POST /api/archive/cleanup
```

### Metrics (`metricsRoutes.js`)
```javascript
metricsLimiter: 120 requests / minute
- GET /api/visits
- POST /api/visits
```

## Response Format

When rate limit is exceeded, the API returns:
```json
{
  "success": false,
  "message": "Too many requests. Please slow down."
}
```

**HTTP Status Code**: 429 (Too Many Requests)

## Benefits

1. **Brute Force Protection**: Strict limits on authentication endpoints prevent password guessing attacks
2. **DoS Prevention**: Rate limits prevent individual IPs from overwhelming the server
3. **Fair Usage**: Ensures all users get fair access to resources
4. **Resource Protection**: Lower limits on expensive operations (uploads, complex queries)
5. **Spam Prevention**: Strict limits on submission endpoints prevent spam

## Monitoring and Tuning

### Current Limitations
- In-memory storage means limits are per-process (not shared across multiple instances)
- Limits reset when server restarts
- No persistent tracking of abuse patterns

### Recommendations for Production

1. **Upgrade to Redis-backed rate limiting**:
   ```bash
   npm install express-rate-limit rate-limit-redis ioredis
   ```

2. **Implement monitoring**:
   - Log 429 responses
   - Track which IPs hit limits most frequently
   - Set up alerts for unusual rate limit patterns

3. **Consider user-specific limits**:
   - Different limits for authenticated vs anonymous users
   - Higher limits for verified/premium accounts

4. **Add rate limit headers**:
   - `X-RateLimit-Limit`: Maximum requests allowed
   - `X-RateLimit-Remaining`: Requests remaining
   - `X-RateLimit-Reset`: Time when limit resets

## Testing Rate Limits

To test rate limits in development, you can temporarily lower the limits in the middleware configuration:

```javascript
// Example: Test auth rate limit
const authLimiter = rateLimit({ 
  windowMs: 60 * 1000, // 1 minute 
  max: 3 // Only 3 requests per minute for testing
});
```

## Security Best Practices

1. Rate limiting is one layer of defense - always use in combination with:
   - Input validation
   - Authentication/authorization
   - HTTPS/TLS
   - Security headers (Helmet)
   
2. Keep rate limits documented and communicated to API consumers

3. Regularly review and adjust limits based on usage patterns

4. Consider implementing progressive delays instead of hard blocks for some endpoints

## Future Enhancements

- [ ] Redis-backed rate limiting for multi-instance deployments
- [ ] User-specific rate limits based on account type
- [ ] Rate limit response headers
- [ ] Whitelist for trusted IPs/applications
- [ ] Rate limit analytics dashboard
- [ ] Configurable rate limits via environment variables
- [ ] Progressive rate limiting (warnings before blocks)
