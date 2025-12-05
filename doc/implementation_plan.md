# Fix Login 500 Error (Port Conflict)

## Problem Description
Users are experiencing a 500 Internal Server Error when logging in to `https://auto.lumiku.com/login`.
Investigation reveals that the error is caused by a **port conflict** on the host server.
- Another application (Laravel/MDXM) is running in a Docker container and binding to **host port 3000**.
- The `autolumiku` application is also configured to use port 3000 (internally), but Coolify seems to be routing traffic to the **host port 3000** instead of the `autolumiku` container's internal port.
- As a result, login requests are hitting the Laravel application, which returns `405 Method Not Allowed` (for POST) or other errors, which are displayed as "Internal Server Error" to the user.

## Proposed Changes
To resolve this conflict, we need to move `autolumiku` to a different port to avoid the conflict with the existing Laravel application.

### Configuration Updates
#### [MODIFY] [docker-compose.yml](file:///home/yopi/Projects/autolumiku/docker-compose.yml)
- Change the exposed port from `3000` to `3001`.
- Update the `PORT` environment variable to `3001`.

#### [MODIFY] [Dockerfile](file:///home/yopi/Projects/autolumiku/Dockerfile)
- Update the `EXPOSE` instruction to `3001`.

#### [MODIFY] [.env](file:///home/yopi/Projects/autolumiku/.env)
- Update `PORT=3001`.

### Deployment
- Redeploy the application using the hotfix script or Coolify.
- Note: The user MUST update the Coolify configuration for the `autolumiku-app` service to expose port **3001** instead of 3000. This is critical as the container is now listening on 3001.

## Verification Plan
### Automated Tests
- Run `curl` to `localhost:3001` (or the new container IP:3001) to verify the application is reachable.
- Run `curl` to `https://auto.lumiku.com/login` to verify it hits the correct application (check for "AutoLumiKu" in response).

### Manual Verification
- User should try to login again at `https://auto.lumiku.com/login`.
