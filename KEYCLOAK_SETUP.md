# Keycloak Setup Guide

This guide will help you set up Keycloak for local development and configure it for use with the HMeet backend.

## Prerequisites

- Docker and Docker Compose installed
- HMeet backend repository cloned

## Starting Keycloak

1. **Start Keycloak and PostgreSQL using Docker Compose:**

```bash
docker-compose up -d
```

2. **Wait for Keycloak to start** (this may take 30-60 seconds). You can check the logs:

```bash
docker-compose logs -f keycloak
```

3. **Access Keycloak Admin Console:**

Open your browser and navigate to: `http://localhost:8080`

**Default Admin Credentials:**
- Username: `admin`
- Password: `admin`

## Creating a Realm

1. Click on the dropdown in the top-left corner (currently showing "master")
2. Click "Create Realm"
3. Enter realm name: `hmeet`
4. Click "Create"

## Creating a Client

1. In the left sidebar, click "Clients"
2. Click "Create client"
3. **General Settings:**
   - Client type: `OpenID Connect`
   - Client ID: `hmeet-backend`
   - Click "Next"

4. **Capability config:**
   - Client authentication: `ON`
   - Authorization: `OFF`
   - Authentication flow:
     - ✅ Standard flow
     - ✅ Direct access grants
     - ✅ Service accounts roles
   - Click "Next"

5. **Login settings:**
   - Valid redirect URIs: `http://localhost:3001/*` (add your frontend URL)
   - Valid post logout redirect URIs: `http://localhost:3001/*`
   - Web origins: `http://localhost:3001` (for CORS)
   - Click "Save"

6. **Get Client Secret:**
   - Go to the "Credentials" tab
   - Copy the "Client secret"
   - Update your `.env.development` file:
     ```
     KEYCLOAK_CLIENT_SECRET=<paste-your-client-secret-here>
     ```

## Creating Roles

1. In the left sidebar, click "Realm roles"
2. Click "Create role"
3. Create the following roles:
   - `admin`
   - `user`
   - `moderator`

## Creating a Test User

1. In the left sidebar, click "Users"
2. Click "Add user"
3. Fill in the details:
   - Username: `testuser`
   - Email: `test@example.com`
   - First name: `Test`
   - Last name: `User`
   - Email verified: `ON`
4. Click "Create"

5. **Set Password:**
   - Go to the "Credentials" tab
   - Click "Set password"
   - Enter password: `password` (or your choice)
   - Temporary: `OFF`
   - Click "Save"

6. **Assign Roles:**
   - Go to the "Role mapping" tab
   - Click "Assign role"
   - Select `user` role (and optionally `admin` for testing)
   - Click "Assign"

## Testing Authentication

### Option 1: Using Postman or cURL

1. **Get an Access Token:**

```bash
curl -X POST 'http://localhost:8080/realms/hmeet/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=hmeet-backend' \
  -d 'client_secret=YOUR_CLIENT_SECRET' \
  -d 'username=testuser' \
  -d 'password=password' \
  -d 'grant_type=password'
```

2. **Copy the `access_token` from the response**

3. **Test Protected Endpoint:**

```bash
curl -X GET 'http://localhost:3000/api/profile' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

### Option 2: Using the Backend Endpoints

1. **Test Public Endpoint (no auth required):**
```bash
curl http://localhost:3000/api
# Should return: "Hello World!"
```

2. **Test Protected Endpoint (requires auth):**
```bash
curl http://localhost:3000/api/profile
# Should return: 401 Unauthorized
```

3. **Test with Valid Token:**
```bash
curl http://localhost:3000/api/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
# Should return user profile
```

4. **Test Role-Based Endpoint:**
```bash
curl http://localhost:3000/api/admin \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
# Should return admin data if user has 'admin' role
# Should return 403 Forbidden if user doesn't have 'admin' role
```

## Environment Configuration

Make sure your `.env.development` file has the correct values:

```env
# Application
PORT=3000
NODE_ENV=development

# Keycloak Configuration
KEYCLOAK_AUTH_SERVER_URL=http://localhost:8080
KEYCLOAK_REALM=hmeet
KEYCLOAK_CLIENT_ID=hmeet-backend
KEYCLOAK_CLIENT_SECRET=your-actual-client-secret

# JWT Configuration
JWT_ISSUER=http://localhost:8080/realms/hmeet
JWT_AUDIENCE=account

# CORS Configuration
CORS_ORIGIN=http://localhost:3001,http://localhost:4200
```

## Troubleshooting

### Keycloak won't start
- Check if port 8080 is already in use
- Check Docker logs: `docker-compose logs keycloak`
- Try restarting: `docker-compose restart keycloak`

### 401 Unauthorized errors
- Verify the token is not expired (default: 5 minutes)
- Check that the token is in the format: `Bearer <token>`
- Verify the client secret in `.env.development` matches Keycloak

### 403 Forbidden errors
- Check that the user has the required role
- Verify role mapping in Keycloak user settings
- Check that roles are being extracted correctly (check JWT payload)

### CORS errors
- Verify `Web origins` is set correctly in Keycloak client settings
- Check `CORS_ORIGIN` in `.env.development`
- Restart the backend after changing environment variables

## Stopping Keycloak

```bash
docker-compose down
```

To remove all data (including database):
```bash
docker-compose down -v
```

## Production Deployment

For production:

1. Use a proper database (not the Docker volume)
2. Enable HTTPS for Keycloak
3. Use strong admin credentials
4. Configure proper realm and client settings
5. Update `.env.production` with production URLs
6. Consider using Keycloak in a Kubernetes cluster or managed service

## Additional Resources

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [Keycloak Admin REST API](https://www.keycloak.org/docs-api/latest/rest-api/index.html)
- [OAuth 2.0 and OpenID Connect](https://oauth.net/2/)
