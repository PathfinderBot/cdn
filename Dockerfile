FROM docker.io/library/node:26
# eMudhra CA compromise (2026-10): drop the compromised emSign ECC Root CA - C3 root.
RUN rm -f /usr/share/ca-certificates/mozilla/emSign_ECC_Root_CA_-_C3.crt && update-ca-certificates
RUN apt-get update && apt-get install -y curl
WORKDIR /usr/src/app
COPY . .
RUN npm ci
ENV WRANGLER_SEND_METRICS=false
CMD [ "npm", "start" ]