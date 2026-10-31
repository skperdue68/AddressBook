FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
# Install exactly what package-lock.json pins, without dev dependencies.
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
RUN mkdir -p /app/data && chown -R node:node /app/data && chmod +x scripts/docker-entrypoint.sh
# The web portal only starts after the Discord client is ready, so allow a generous start period.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD ["node", "scripts/healthcheck.js"]
# The entrypoint starts as root only to fix ownership of the data directories, then runs the app as the unprivileged "node" user.
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["sh","-c","node src/db/init.js && node src/db/seed-houses.js && node src/index.js"]
