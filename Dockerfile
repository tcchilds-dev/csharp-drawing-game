# syntax=docker/dockerfile:1

# Build the React client into static files.
FROM node:24-alpine AS client
WORKDIR /src
COPY DrawingGame.Client/package.json DrawingGame.Client/package-lock.json ./
RUN npm ci
COPY DrawingGame.Client/ ./
RUN npm run build

# Publish the ASP.NET Core API.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY DrawingGame.Api/DrawingGame.Api.csproj DrawingGame.Api/
RUN dotnet restore DrawingGame.Api/DrawingGame.Api.csproj
COPY DrawingGame.Api/ DrawingGame.Api/
RUN dotnet publish DrawingGame.Api/DrawingGame.Api.csproj -c Release -o /app --no-restore

# Runtime: the API serves the client from wwwroot, so the browser, the hub and
# the static files all share one origin.
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=api /app ./
COPY --from=client /src/dist ./wwwroot
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "DrawingGame.Api.dll"]
