FROM docker.io/library/node:26
RUN apt-get update && apt-get install -y curl
WORKDIR /usr/src/app
COPY . .
RUN npm ci
ENV WRANGLER_SEND_METRICS=false
CMD [ "npm", "start" ]